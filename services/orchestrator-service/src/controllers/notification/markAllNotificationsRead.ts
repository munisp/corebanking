import httpStatus from "http-status";
import { AppDataSource } from "../../database/dataSource";
import { NotificationEntity } from "../../entity/Notification";
import { asyncHandler } from "../../middlewares/async";
import { getAuthContext, resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";

// PUT /notifications/mark-all-read — mark every inbox entry read.
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const userId = getAuthContext(res)?.subject;
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Authenticated user could not be established.");
  }

  const repo = AppDataSource.getRepository(NotificationEntity);
  const result = await repo
    .createQueryBuilder()
    .update(NotificationEntity)
    .set({ is_read: true, read_at: new Date() })
    .where("tenant_id = :tenantId AND user_id = :userId AND is_read = :unread", {
      tenantId,
      userId,
      unread: false,
    })
    .execute();

  return res.status(httpStatus.OK).json({
    success: true,
    message: "All notifications marked as read.",
    updated: result.affected ?? 0,
  });
});
