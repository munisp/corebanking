import httpStatus from "http-status";
import { AppDataSource } from "../../database/dataSource";
import { RewardEventEntity } from "../../entity/RewardEvent";
import { asyncHandler } from "../../middlewares/async";
import { getAuthContext, resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";

// GET /rewards/earned — points credit history for the authenticated customer.
export const getEarnedRewards = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const userId = getAuthContext(res)?.subject;
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Authenticated user could not be established.");
  }

  const repo = AppDataSource.getRepository(RewardEventEntity);
  const rows = await repo.find({
    where: { tenant_id: tenantId, user_id: userId },
    order: { created_at: "DESC" },
    take: 100,
  });

  return res.status(httpStatus.OK).json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      title: r.title,
      description: r.description,
      points: r.points,
      category: r.category,
      date: r.created_at,
      transaction_id: r.transaction_id ?? undefined,
    })),
  });
});
