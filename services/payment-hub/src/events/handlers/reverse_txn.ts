import httpStatus from "http-status";
import logger from "../../config/logger.config";
import { CoreBankingApiClient } from "../../lib/CoreBankingApiClient";
import { makerCheckerApiClient } from "../../lib/MakerCheckerApiClient";
import { IReverseTransactionEvent } from "../../types/events";
import ApiError from "../../utils/ApiError";
import { validateRequest } from "../../validations";
import { ReverseTransferEventSchema } from "../../validations/v1/events";

/**
 * MN-07 (S7/F7-05): reversal consumer with real money movement.
 *
 * - Idempotent: the compensating credit uses the deterministic reference
 *   `reversal:{local_transaction_id}`; payment-processing turns that into a
 *   deterministic TigerBeetle transfer id, so event replays are ledger no-ops.
 * - Maker-checker: reversals above REVERSAL_APPROVAL_THRESHOLD_KOBO require a
 *   maker-checker-go approval BEFORE funds move (fail-closed on outage).
 * - Balancing GL journal: the compensating deposit publishes a
 *   transaction_success event consumed by transaction-ledger, which posts the
 *   balancing journal (Dr mint / Cr payer) reversing the original leg.
 */
export const reverse_txn = async (data: IReverseTransactionEvent) => {
  logger.info(`reverse_txn event: ${JSON.stringify(data)}`);

  const payload = validateRequest(ReverseTransferEventSchema, data);

  const amountKobo = Math.round(Number(payload.amount) * 100);
  const reversalReference = `reversal:${payload.local_transaction_id}`;

  const approvalThreshold = Number(
    process.env.REVERSAL_APPROVAL_THRESHOLD_KOBO || "0",
  );
  if (amountKobo >= approvalThreshold) {
    try {
      const approval = await makerCheckerApiClient.createApproval(payload.tenant, {
        reference: reversalReference,
        operation: "reversal",
        entityType: "transaction",
        entityId: payload.local_transaction_id,
        amountKobo,
        currency: payload.currency,
        makerId: "payment-hub:reverse_txn",
        makerName: "payment-hub reverse_txn consumer",
        payload: {
          operation: "reversal",
          tenantId: payload.tenant,
          reversalPayload: {
            local_transaction_id: payload.local_transaction_id,
            id_type: payload.id_type,
            id_value: payload.id_value,
            amount: payload.amount,
            currency: payload.currency,
            tenant: payload.tenant,
          },
        },
      });
      logger.info(
        `Reversal submitted for maker-checker approval requestId=${approval.id} ref=${reversalReference}`,
      );
      // The reversal executes via the approval callback path; do not move
      // funds here before approval is granted.
      return;
    } catch (error) {
      // Fail-closed: without an approval the reversal must not execute.
      logger.error("reverse_txn maker-checker unavailable, refusing reversal:", error);
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        "Reversal approval service unavailable; reversal not executed",
      );
    }
  }

  try {
    const response = await CoreBankingApiClient.getInstance().fund_account(
      {
        payee: {
          partyIdType: payload.id_type,
          partyIdentifier: payload.id_value,
        },
        amount: {
          currency: payload.currency,
          amount: payload.amount,
        },
        source: "reverse_transfer",
        note: `Reversal for ${payload.local_transaction_id}`,
        transaction_id: reversalReference,
      },
      payload.tenant,
    );

    logger.info(`reverse_txn completed: ${JSON.stringify(response)}`);
  } catch (error) {
    // MN-07: dead-letter — rethrow so Dapr redelivers, and emit a CRITICAL
    // alert for ops (reversal failure leaves funds stranded at mint).
    logger.error(
      `CRITICAL: reverse_txn failed for ${payload.local_transaction_id}; funds may be stranded at mint:`,
      error,
    );
    throw error;
  }
};
