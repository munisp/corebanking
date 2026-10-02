import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { REWARD_CATALOG } from "./rewardCatalog";

// GET /rewards/redeem-options — the redemption catalog.
export const getRedeemOptions = asyncHandler(async (_req, res) => {
  return res.status(httpStatus.OK).json({
    success: true,
    data: REWARD_CATALOG,
  });
});
