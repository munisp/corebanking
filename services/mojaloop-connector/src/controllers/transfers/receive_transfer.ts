import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import ApiError from "../../utils/ApiError";
import { PrepareTransferSchema, validateRequest } from "../../validations";
import { daprClient, redisClient } from "../../services";
import createLogger from "../../config/logger.config";
import { extract_name_form_path } from "../../utils/helpers";
import { readEnv } from "../../config/readEnv.config";
import { ICachedQuoteData, IIlpPrepTxnData } from "../../types";
import { createHash } from "crypto";
import { deserializeIlpPacket, IlpPrepare } from "ilp-packet";
import { MojaloopApiClient } from "../../lib/MojaloopApiClient";
import { HttpMethod } from "@dapr/dapr";
import { PartyIdTypeEnum, PubSubTopics, TransactionDirectionEnum } from "../../utils/enums";
import { ITransactionCompletedEvent } from "../../types/events";
import { lowerDenominatorMultiplier } from "../../utils/constants";
import { IFineractWithdrawResponse } from "../../types/api.response";
import { sanctionsScreeningApiClient } from "../../lib/SanctionsScreeningApiClient";
import { AppDataSource } from "../../database/dataSource";
import { SanctionsBlockedAlert } from "../../models/SanctionsBlockedAlert";

const logger = createLogger(extract_name_form_path(__filename));
const tenant = readEnv("TENANT_NAME", "ucard") as string;

export const receive_transfer = asyncHandler(async (req, res) => {
  const source = req.headers["fspiop-source"] as string;
  const destination = req.headers["fspiop-destination"] as string | undefined;

  logger.info(`prepare_transfer source: ${source} destination: ${destination} tenant: ${tenant}`);

  if (tenant !== destination) {
    throw new ApiError(httpStatus.BAD_REQUEST, "The incoming quote request is invalid");
  }

  const payload = validateRequest(PrepareTransferSchema, req.body);

  res.status(httpStatus.ACCEPTED).send();

  try {
    const quotePersistKey = `quote:payee:${payload.transferId}`;

    const cached_data = (await redisClient.get(quotePersistKey)) as string;
    if (!cached_data) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Timeout");
    }

    const parsed_cached_data = JSON.parse(cached_data) as ICachedQuoteData;
    logger.info(`parsed_cached_data: ${JSON.stringify(parsed_cached_data)}`);

    // validate ilpPacket
    const { ilpPacket, condition } = payload;

    const fulfillment_buffer = Buffer.from(parsed_cached_data.fulfillment, "base64url");

    const expectedCondition = createHash("sha256").update(fulfillment_buffer).digest().toString("base64url");
    logger.info(`Expected condition: ${expectedCondition}`);

    if (condition !== expectedCondition) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid condition or secret");
    }

    const packetBuffer = Buffer.from(ilpPacket, "base64url");
    let { data } = deserializeIlpPacket(packetBuffer);
    data = data as IlpPrepare;

    logger.info(`Deserialized packet: ${JSON.stringify(data)}`);

    // Validate ilp-packet data
    if (data.amount != parsed_cached_data.amount) throw new Error("Amount mismatch");
    if (data.destination !== parsed_cached_data.ilpAddress) throw new Error("Destination mismatch");
    if (data.executionCondition.toString("base64url") !== expectedCondition)
      throw new Error("Condition mismatch");

    const transaction_data = JSON.parse(data.data.toString("utf8")) as IIlpPrepTxnData;

    logger.info(`transaction data: ${JSON.stringify(transaction_data)}`);

    const destination_details = data.destination.split(".");
    const id_type = destination_details.at(destination_details.length - 2) as PartyIdTypeEnum;
    let id_value = destination_details.at(destination_details.length - 1) as string;

    if (id_value[0] !== "+") {
      id_value = `+${id_value}`;
    }

    logger.info(`Destination details ${id_type} ${id_value}`);

    const deposit_amount = Number(data.amount) / lowerDenominatorMultiplier[payload.amount.currency];

    logger.info(`Deposit amount: ${deposit_amount}`);

    // MN-13 (S13): screen the beneficiary BEFORE the deposit. Fail-closed:
    // screening unavailable => no credit. On block/hold, funds are routed to
    // the sanctions-suspense account (never silently to the beneficiary and
    // never vanished), an alert is persisted, and an STR-filing event fires.
    const screening = await sanctionsScreeningApiClient.screen({
      name: id_value,
      tenant_id: tenant,
      triggered_by: "mojaloop-connector:receive_transfer",
      transaction_id: transaction_data.transactionId,
      screen_type: "transaction",
    });

    let creditPartyIdValue = id_value;
    if (screening.action !== "proceed") {
      const suspenseAccountId = readEnv("SANCTIONS_SUSPENSE_ACCOUNT_ID", "") as string;
      if (!suspenseAccountId) {
        // Fail-fast: there is nowhere safe to park blocked funds.
        throw new Error(
          "Sanctions block but SANCTIONS_SUSPENSE_ACCOUNT_ID is not configured",
        );
      }
      creditPartyIdValue = suspenseAccountId;

      const alert = new SanctionsBlockedAlert();
      alert.transfer_id = payload.transferId;
      alert.beneficiary = id_value;
      alert.payer_fsp = source;
      alert.amount = data.amount;
      alert.currency = transaction_data.currency;
      alert.screening_id = screening.id;
      alert.risk_level = screening.risk_level;
      alert.action = screening.action;
      alert.suspense_account_id = suspenseAccountId;
      alert.status = "open";
      alert.str_filed = false;
      alert.note = `Inbound transfer ${payload.transferId} blocked by sanctions screening; funds parked in suspense`;
      try {
        await AppDataSource.manager.save(alert);
      } catch (dbErr: any) {
        // Persist-or-die: a blocked transfer without an audit row must not proceed.
        logger.error(`SanctionsBlockedAlert persistence failed: ${dbErr?.message}`);
        throw new Error("Failed to persist sanctions-blocked alert; transfer aborted");
      }

      try {
        await daprClient.publishTxnNotification("sanctions.blocked", {
          transfer_id: payload.transferId,
          beneficiary: id_value,
          payer_fsp: source,
          amount: data.amount,
          currency: transaction_data.currency,
          screening_id: screening.id,
          risk_level: screening.risk_level,
          action: screening.action,
          alert_id: alert.id,
          suspense_account_id: suspenseAccountId,
          tenant,
        });
      } catch (pubErr: any) {
        logger.error(`sanctions.blocked publish failed (STR filing at risk): ${pubErr?.message}`);
      }

      logger.error(
        `ALERT sanctions.blocked transfer=${payload.transferId} beneficiary=${id_value} action=${screening.action} suspense=${suspenseAccountId}`,
      );
    }

    logger.info(`Attempt to credit the customer`);

    const result = (await daprClient.invoke(
      readEnv("CORE_BANKING_CONNECT_DAPR_ID", "core-banking") as string,
      "transfers/deposit",
      HttpMethod.POST,
      {
        payee: { partyIdType: id_type, partyIdentifier: creditPartyIdValue },
        amount: {
          amount: deposit_amount.toString(),
          currency: transaction_data.currency,
        },
        source,
        transaction_id: transaction_data.transactionId,
      }
    )) as IFineractWithdrawResponse;

    if (screening.action !== "proceed") {
      // Funds are safe in suspense; reject the transfer at the switch so the
      // payer FSP sees the failure and no fulfilment is committed downstream.
      await MojaloopApiClient.getInstance().send_transfer_error(
        payload.transferId,
        "Beneficiary blocked by sanctions screening; funds routed to suspense",
        destination,
        source,
      );
      return;
    }

    logger.info(`credit is successfull`);

    try {
      daprClient.publishTxnNotification<ITransactionCompletedEvent>(PubSubTopics.transaction_completed, {
        transaction_id: transaction_data.transactionId,
        note: transaction_data.note,
        direction: TransactionDirectionEnum.incoming,
        local_transaction_id: (result.resourceId ?? result.transactionId).toString(),
      });
    } catch (error) {
      logger.error("Error publishing the transaction_completed event", error);
    }

    // notify payee
    logger.info("Notify payee about received money");

    // send res to switch
    await MojaloopApiClient.getInstance().send_transfer_res(tenant, source, transaction_data.transactionId, {
      fulfilment: parsed_cached_data.fulfillment,
      completedTimestamp: new Date().toISOString(),
      transferState: "COMMITTED",
    });
  } catch (error) {
    logger.error("Error processing prepare transfer", error);

    if (error instanceof ApiError) {
      await MojaloopApiClient.getInstance().send_transfer_error(
        payload.transferId,
        error.message,
        destination,
        source
      );
    }

    if (error instanceof Error) {
      await MojaloopApiClient.getInstance().send_transfer_error(
        payload.transferId,
        error.message,
        destination,
        source
      );
    }

    await MojaloopApiClient.getInstance().send_transfer_error(
      payload.transferId,
      "Unknown error",
      destination,
      source
    );
  }
});
