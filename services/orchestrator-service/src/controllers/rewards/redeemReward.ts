import crypto from "crypto";
import httpStatus from "http-status";
import { AppDataSource } from "../../database/dataSource";
import { RewardRedemptionEntity } from "../../entity/RewardRedemption";
import { asyncHandler } from "../../middlewares/async";
import { getAuthContext, resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";
import { findRewardOption } from "./rewardCatalog";
import { computeRewardBalance } from "./rewardBalance";

// POST /rewards/redeem — redeem points against a catalog option.
// Verifies the real points balance before persisting the redemption.
export const redeemReward = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const userId = getAuthContext(res)?.subject;
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Authenticated user could not be established.");
  }

  const optionId = req.body?.option_id;
  if (typeof optionId !== "string" || !optionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "option_id is required.");
  }
  const option = findRewardOption(optionId);
  if (!option || !option.is_available) {
    throw new ApiError(httpStatus.NOT_FOUND, "Redemption option not found or unavailable.");
  }

  const balance = await computeRewardBalance(tenantId, userId);
  const totalPoints = balance.lifetimeEarned - balance.lifetimeRedeemed;
  if (totalPoints < option.points_required) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient reward points for this option.");
  }

  const repo = AppDataSource.getRepository(RewardRedemptionEntity);
  const redemption = repo.create({
    tenant_id: tenantId,
    user_id: userId,
    option_id: option.id,
    title: option.title,
    points_spent: option.points_required,
    status: "completed",
    tracking_number: `RDM-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
  });
  await repo.save(redemption);

  return res.status(httpStatus.OK).json({
    success: true,
    message: "Reward redeemed successfully",
    data: {
      id: redemption.id,
      option_id: redemption.option_id,
      title: redemption.title,
      points_spent: redemption.points_spent,
      date: redemption.created_at,
      status: redemption.status,
      tracking_number: redemption.tracking_number,
    },
  });
});
