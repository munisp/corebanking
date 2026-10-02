import httpStatus from "http-status";
import { AppDataSource } from "../../database/dataSource";
import { RewardRedemptionEntity } from "../../entity/RewardRedemption";
import { asyncHandler } from "../../middlewares/async";
import { getAuthContext, resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";

// GET /rewards/redemption-history — past redemptions for the authenticated customer.
export const getRedemptionHistory = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const userId = getAuthContext(res)?.subject;
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Authenticated user could not be established.");
  }

  const repo = AppDataSource.getRepository(RewardRedemptionEntity);
  const rows = await repo.find({
    where: { tenant_id: tenantId, user_id: userId },
    order: { created_at: "DESC" },
    take: 100,
  });

  return res.status(httpStatus.OK).json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      option_id: r.option_id,
      title: r.title,
      points_spent: r.points_spent,
      date: r.created_at,
      status: r.status,
      tracking_number: r.tracking_number ?? undefined,
    })),
  });
});
