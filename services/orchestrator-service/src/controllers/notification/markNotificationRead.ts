import httpStatus from "http-status";
import { AppDataSource } from "../../database/dataSource";
import { NotificationEntity } from "../../entity/Notification";
import { asyncHandler } from "../../middlewares/async";
import { getAuthContext, resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";

// PUT /notifications/:id/read — mark a single inbox entry read.
export const markNotificationRead = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const userId = getAuthContext(res)?.subject;
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Authenticated user could not be established.");
  }

  const repo = AppDataSource.getRepository(NotificationEntity);
  const notification = await repo.findOne({
    where: { id: req.params.id, tenant_id: tenantId, user_id: userId },
  });
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found.");
  }

  notification.is_read = true;
  notification.read_at = new Date();
  await repo.save(notification);

  return res.status(httpStatus.OK).json({ success: true, message: "Notification marked as read." });
});
