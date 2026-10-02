import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { getAuthContext, resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";
import { computeRewardBalance } from "./rewardBalance";

const TIERS: { name: string; threshold: number }[] = [
  { name: "Bronze", threshold: 0 },
  { name: "Silver", threshold: 1000 },
  { name: "Gold", threshold: 5000 },
  { name: "Platinum", threshold: 20000 },
];

// GET /rewards/summary — points balance, monthly movement and tier.
export const getRewardsSummary = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const userId = getAuthContext(res)?.subject;
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Authenticated user could not be established.");
  }

  const balance = await computeRewardBalance(tenantId, userId);
  const totalPoints = Math.max(0, balance.lifetimeEarned - balance.lifetimeRedeemed);

  let tier = TIERS[0].name;
  let nextTierPoints = TIERS[1].threshold;
  for (let i = 0; i < TIERS.length; i++) {
    if (totalPoints >= TIERS[i].threshold) {
      tier = TIERS[i].name;
      nextTierPoints = i + 1 < TIERS.length ? TIERS[i + 1].threshold : TIERS[i].threshold;
    }
  }

  return res.status(httpStatus.OK).json({
    success: true,
    data: {
      total_points: totalPoints,
      earned_this_month: balance.earnedThisMonth,
      redeemed_this_month: balance.redeemedThisMonth,
      tier,
      next_tier_points: nextTierPoints,
      lifetime_earned: balance.lifetimeEarned,
      lifetime_redeemed: balance.lifetimeRedeemed,
    },
  });
});
