import httpStatus from "http-status";
import createLogger from "../../config/logger.config";
import { asyncHandler } from "../../middlewares/async";
import { extract_name_form_path } from "../../utils/helpers";
import { PutTransferCallback, validateRequest } from "../../validations";
import { daprClient } from "../../services";
import { AppDataSource } from "../../database/dataSource";
import { PubSubTopics, TransactionDirectionEnum } from "../../utils/enums";
import { ITransactionCompletedEvent } from "../../types/events";

const logger = createLogger(extract_name_form_path(__filename));

const PROVIDER = "mojaloop";

export const put_transfer_callback = asyncHandler(async (req, res) => {
  logger.info("put_transfer_callback");
  logger.info(JSON.stringify(req.headers));

  const payload = validateRequest(PutTransferCallback, {
    ...req.params,
    ...req.body,
  });

  // MN-14 (S14): durable dedup — claim (provider, external_id) atomically.
  // A replayed fulfil callback returns 200 with the prior outcome and does
  // NOT re-fire downstream events (callback storms previously re-published
  // transaction_completed on every receipt).
  try {
    const claimed = await AppDataSource.query(
      `INSERT INTO processed_callbacks (provider, external_id, outcome)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider, external_id) DO NOTHING
       RETURNING id`,
      [PROVIDER, payload.transfer_id, "received"],
    );
    if (!claimed || claimed.length === 0) {
      logger.warn(
        `Duplicate fulfil callback for transfer ${payload.transfer_id}; returning prior outcome`,
      );
      return res.status(httpStatus.OK).send();
    }
  } catch (error: any) {
    // Fail-closed: without the dedup table we cannot prove this callback
    // was not already processed — better to reject and let the switch retry.
    logger.error(`Callback dedup store unavailable: ${error?.message}`);
    return res
      .status(httpStatus.SERVICE_UNAVAILABLE)
      .json({ message: "Callback dedup store unavailable; retry later" });
  }

  try {
    await daprClient.publishTxnNotification<ITransactionCompletedEvent>(
      PubSubTopics.transaction_completed,
      {
        transaction_id: payload.transfer_id,
        direction: TransactionDirectionEnum.outgoing,
        completed_at: payload.completedTimestamp,
        fulfilment: payload.fulfilment,
      },
    );
    await AppDataSource.query(
      `UPDATE processed_callbacks SET outcome = $1 WHERE provider = $2 AND external_id = $3`,
      ["completed", PROVIDER, payload.transfer_id],
    );
  } catch (error: any) {
    logger.error(
      `transaction_completed publish failed for ${payload.transfer_id}: ${error?.message}`,
    );
    // Release the claim so the switch's retry can be processed — the dedup
    // record only persists for callbacks that were actually handled.
    await AppDataSource.query(
      `DELETE FROM processed_callbacks WHERE provider = $1 AND external_id = $2 AND outcome = 'received'`,
      [PROVIDER, payload.transfer_id],
    ).catch((e: any) =>
      logger.error(`Failed to release callback claim for ${payload.transfer_id}: ${e?.message}`),
    );
    throw error;
  }

  res.status(httpStatus.OK).send();

  logger.info("put_transfer_callback end");
});
