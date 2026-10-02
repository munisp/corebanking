import { Router } from "express";
import { postAgentKycCallback } from "../controllers/agent/postAgentKycCallback";
import { postCreateAgent } from "../controllers/agent/postCreateAgent";
import { permifyGuard } from "../middlewares/permifyGuard"; // W12-B5P1DF

const router = Router();

router.route("/").post(permifyGuard("onboarding_workflow", "create"), postCreateAgent);
router.route("/kyc/callback").post(postAgentKycCallback);

export default router;
