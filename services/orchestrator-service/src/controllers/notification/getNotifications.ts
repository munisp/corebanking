import httpStatus from "http-status";
import { AppDataSource } from "../../database/dataSource";
import { NotificationEntity } from "../../entity/Notification";
import { asyncHandler } from "../../middlewares/async";
import { getAuthContext, resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";

// GET /notifications — in-app inbox for the authenticated customer.
export const getNotifications = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const userId = getAuthContext(res)?.subject;
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Authenticated user could not be established.");
  }

  const repo = AppDataSource.getRepository(NotificationEntity);
  const rows = await repo.find({
    where: { tenant_id: tenantId, user_id: userId },
    order: { created_at: "DESC" },
    take: 100,
  });

  return res.status(httpStatus.OK).json({
    success: true,
    data: rows.map((n) => ({
      id: n.id,
      user_id: n.user_id,
      title: n.title,
      body: n.body,
      type: n.type,
      is_read: n.is_read,
      created_at: n.created_at,
      read_at: n.read_at ?? undefined,
    })),
  });
});
