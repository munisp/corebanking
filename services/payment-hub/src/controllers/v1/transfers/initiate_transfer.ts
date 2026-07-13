import httpStatus from "http-status";
import logger from "../../../config/logger.config";
import { MojaloopConnectorApiClient } from "../../../lib/MojaloopConnectorApiClient";
import { VfdConnectorApiClient } from "../../../lib/VfdConnectorApiClient";
import { billingApiClient } from "../../../lib/BillingApiClient";
import { makerCheckerApiClient } from "../../../lib/MakerCheckerApiClient";
import { nfiuApiClient } from "../../../lib/NfiuApiClient";
import { sanctionsScreeningApiClient } from "../../../lib/SanctionsScreeningApiClient";
import { asyncHandler } from "../../../middlewares/async";
import { readEnv } from "../../../config/readEnv.config";
import { daprClient } from "../../../services/daprClient";
import ApiError from "../../../utils/ApiError";
import {
  AppAmsEnum,
  AppSwitchEnum,
  SUPPORTED_CORE_AMS,
  TransferTypeEnum,
} from "../../../utils/enums";
import { validateRequest } from "../../../validations";
import {
  InitiateTransferSchema,
  InitiateTransferSchemaMojaloop,
  InitiateTransferSchemaVfd,
  TInitiateTransferSchemaMojaloop,
  TInitiateTransferSchemaVfd,
} from "../../../validations/v1";

const getHeaderValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
) => {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

export const initiate_transfer_mojaloop = async (
  data: TInitiateTransferSchemaMojaloop,
  headers: Record<string, string> = {},
) => {
  data = InitiateTransferSchemaMojaloop.parse(data);
  return await MojaloopConnectorApiClient.getInstance().initialize_transfer(
    data,
    headers,
  );
};

export const initiate_transfer_vfd = async (
  data: TInitiateTransferSchemaVfd,
  tenant: string,
) => {
  data = InitiateTransferSchemaVfd.parse(data);

  if (data.toBank == "999999") {
    data.transferType = TransferTypeEnum.INTRA;
  }

  return await VfdConnectorApiClient.instance().initialize_transfer(
    data,
    tenant,
  );
};

export const initiate_transfer = asyncHandler(async (req, res) => {
  logger.info(
    `Initiate transfer request path=${req.originalUrl} tenant=${req.context?.tenant_name || "unknown"} switch=${req.context?.switch_name || "unknown"} ams=${req.context?.ams_name || "unknown"}`,
  );

  logger.info(`headers: ${JSON.stringify(req.headers)}`);

  req.body.switch_name = req.context.switch_name;

  const tenantId =
    getHeaderValue(req.headers, "x-tenant-id") ||
    getHeaderValue(req.headers, "x-tenent-id") ||
    req.context.tenant_name;

  const keycloakId =
    getHeaderValue(req.headers, "x-keycloak-id") || req.context.tenant_name;

  const ledgerId =
    getHeaderValue(req.headers, "x-ledger-id") || req.context.tenant_name;

  const mintAccountId =
    getHeaderValue(req.headers, "x-mint-account-id") || req.context.tenant_name;

  const pin =
    req.body.pin ||
    getHeaderValue(req.headers, "x-payer-pin") ||
    getHeaderValue(req.headers, "x-pin");

  req.body.pin = pin;

  const forwardedHeaders = {
    "x-tenant-id": tenantId,
    "x-keycloak-id": keycloakId,
    "x-ledger-id": ledgerId,
    "x-mint-account-id": mintAccountId,
  };

  const payload = validateRequest(InitiateTransferSchema, req.body);

  const billingStatus = await billingApiClient.getTenantBillingStatus(tenantId);
  if (billingStatus === "suspended" || billingStatus === "inactive") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Tenant account suspended. Contact support to restore access.",
    );
  }

  const transferAmountNgn = parseFloat(payload.amount);

  const today = new Date().toISOString().slice(0, 10);
  const amountKobo = Math.round(parseFloat(payload.amount) * 100);

  const beneficiaryName =
    payload.switch_name === AppSwitchEnum.vfd
      ? payload.toAccount.name
      : payload.to.displayName ||
        [payload.to.firstName, payload.to.lastName].filter(Boolean).join(" ") ||
        payload.to.idValue;

  const screenAndEnforce = async (
    name: string,
    customerId: string,
    party: "payer" | "beneficiary",
  ) => {
    const result = await sanctionsScreeningApiClient.screen({
      name,
      tenant_id: tenantId,
      triggered_by: keycloakId,
      transaction_id: (payload as any).reference,
      customer_id: customerId,
      screen_type: "transaction",
    });

    if (result.action === "block" || result.action === "hold_and_review") {
      const reason = result.matches
        .map((m) => `${m.list_name}: ${m.matched_name} (score ${m.similarity_score.toFixed(2)})`)
        .join("; ");

      void nfiuApiClient.fileStr(tenantId, {
        customer_id: customerId,
        customer_name: name,
        customer_type: "individual",
        reason: `Sanctions match on ${party}: ${reason}`,
        category: "SANCTIONS",
        total_amount_kobo: amountKobo,
        transaction_count: 1,
        period_start: today,
        period_end: today,
        detection_method: "automated_sanctions_screening",
        risk_score: 95,
        risk_level: "critical",
        transaction_ids: (payload as any).reference ? [(payload as any).reference] : [],
      });
      void daprClient.publishGeneralEvent("sanctions.match-blocked", {
        tenantId,
        party,
        screenedName: name,
        customerId,
        screeningId: result.id,
        riskLevel: result.risk_level,
        action: result.action,
        reason,
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Transfer blocked: sanctions match detected. Compliance team has been notified.",
      );
    }
  };

  await screenAndEnforce(keycloakId, keycloakId, "payer");
  await screenAndEnforce(beneficiaryName, payload.switch_name === AppSwitchEnum.vfd ? payload.toAccount.id : payload.to.idValue, "beneficiary");

  // Gate 4: Maker-checker four-eyes approval for high-value transfers
  const HIGH_VALUE_THRESHOLD_NGN = parseFloat(readEnv<string>("HIGH_VALUE_THRESHOLD_NGN", "1000000")!);
  if (transferAmountNgn >= HIGH_VALUE_THRESHOLD_NGN) {
    const amountKobo = Math.round(transferAmountNgn * 100);
    const callbackBase = readEnv<string>("PAYMENT_HUB_INTERNAL_URL", "http://payment-hub")!;
    const callbackUrl = `${callbackBase}/api/v1/transfers/approval-callback`;
    const reference = (payload as any).reference || `TXN-${Date.now()}-${keycloakId.slice(0, 8)}`;

    const approval = await makerCheckerApiClient.createApproval(tenantId, {
      reference,
      operation: "fund_transfer",
      entityType: "transfer",
      entityId: mintAccountId ?? keycloakId,
      amountKobo,
      currency: (payload as any).currency || "NGN",
      payload: {
        tenantId,
        switchName: payload.switch_name,
        transferPayload: payload,
        forwardedHeaders,
      },
      callbackUrl,
      makerId: keycloakId,
      makerName: keycloakId,
      riskScore: Math.min(100, Math.round((transferAmountNgn / HIGH_VALUE_THRESHOLD_NGN) * 50)),
    });

    logger.info(
      `High-value transfer queued for approval approvalId=${approval.id} amount=₦${transferAmountNgn} threshold=₦${HIGH_VALUE_THRESHOLD_NGN} levels=${approval.levelsRequired}`,
    );

    return res.status(202).json({
      approvalId: approval.id,
      status: "pending_approval",
      message: `Transfer of ₦${transferAmountNgn.toLocaleString()} requires four-eyes approval before processing.`,
      levelsRequired: approval.levelsRequired,
      slaDeadline: approval.slaDeadline,
    });
  }

  if (SUPPORTED_CORE_AMS.includes(req.context.ams_name)) {
    let result;

    switch (payload.switch_name) {
      case AppSwitchEnum.mojaloop:
        {
          const mojaloopPayload = InitiateTransferSchemaMojaloop.parse(payload);
        logger.info(
          `Processing mojaloop transfer from=${mojaloopPayload.from.idValue} to=${mojaloopPayload.to.idValue} amount=${mojaloopPayload.amount} currency=${mojaloopPayload.currency}`,
        );
        logger.info(`Forwarded headers: ${JSON.stringify(forwardedHeaders)}`);
        result = await initiate_transfer_mojaloop(
          mojaloopPayload,
          forwardedHeaders,
        );
        break;
        }

      case AppSwitchEnum.vfd:
        {
          const vfdPayload = InitiateTransferSchemaVfd.parse(payload);
        logger.info(
          `Processing vfd transfer fromAccountId=${vfdPayload.fromAccountId} toAccount=${vfdPayload.toAccount.number} amount=${vfdPayload.amount}`,
        );
        result = await initiate_transfer_vfd(
          vfdPayload,
          req.context.tenant_name,
        );
        break;
        }

      default:
        throw new ApiError(httpStatus.BAD_GATEWAY, "Switch not supported.");
    }

    logger.info(
      `Initiate transfer success path=${req.originalUrl} tenant=${req.context.tenant_name} switch=${payload.switch_name}`,
    );

    return res.json(result);
  }

  throw new ApiError(httpStatus.BAD_GATEWAY, `Ams not supported.`);
});
