import { Router } from "express";
import { getEarnedRewards } from "../controllers/rewards/getEarnedRewards";
import { getRedeemOptions } from "../controllers/rewards/getRedeemOptions";
import { getRedemptionHistory } from "../controllers/rewards/getRedemptionHistory";
import { getRewardsSummary } from "../controllers/rewards/getRewardsSummary";
import { redeemReward } from "../controllers/rewards/redeemReward";

const router = Router();

router.route("/summary").get(getRewardsSummary);
router.route("/earned").get(getEarnedRewards);
router.route("/redeem-options").get(getRedeemOptions);
router.route("/redeem").post(redeemReward);
router.route("/redemption-history").get(getRedemptionHistory);

export default router;
