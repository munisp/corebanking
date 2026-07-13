import httpStatus from "http-status";
import logger from "../../../config/logger.config";
import { asyncHandler } from "../../../middlewares/async";
import ApiError from "../../../utils/ApiError";
import { AppSwitchEnum } from "../../../utils/enums";
import { initiate_transfer_mojaloop, initiate_transfer_vfd } from "./initiate_transfer";

/**
 * POST /api/v1/transfers/approval-callback
 *
 * Called by maker-checker-go when a high-value transfer approval is resolved.
 * On "approved" status, deserialises the stored transfer payload and executes
 * the actual switch call. On any other status (rejected, cancelled, expired)
 * the outcome is acknowledged and the transfer is silently dropped — the
 * originating client should poll maker-checker-go for the final status.
 */
export const approval_callback = asyncHandler(async (req, res) => {
  const { requestId, status, payload: rawPayload } = req.body as {
    requestId: number;
    status: string;
    payload: Record<string, unknown>;
    resolvedAt: string;
  };

  logger.info(`Maker-checker callback requestId=${requestId} status=${status}`);

  if (status !== "approved") {
    logger.info(`Transfer not approved requestId=${requestId} status=${status}`);
    return res.status(httpStatus.OK).json({ message: "Approval outcome recorded", status });
  }

  const tenantId = rawPayload.tenantId as string;
  const switchName = rawPayload.switchName as string;
  const transferPayload = rawPayload.transferPayload as Record<string, unknown>;
  const forwardedHeaders = (rawPayload.forwardedHeaders as Record<string, string>) || {};

  if (!tenantId || !switchName || !transferPayload) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Malformed maker-checker callback payload");
  }

  try {
    let result;
    if (switchName === AppSwitchEnum.vfd) {
      result = await initiate_transfer_vfd(transferPayload as any, tenantId);
    } else {
      result = await initiate_transfer_mojaloop(transferPayload as any, forwardedHeaders);
    }
    logger.info(`High-value transfer executed after maker-checker approval requestId=${requestId}`);
    return res.status(httpStatus.OK).json(result);
  } catch (err: any) {
    logger.error(
      `High-value transfer execution failed post-approval requestId=${requestId}: ${err.message}`
    );
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      `Transfer execution failed after approval: ${err.message}`
    );
  }
});
