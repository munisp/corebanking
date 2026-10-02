import { Router } from "express";
import { postCreateTenant } from "../controllers/tenant/postCreateTenant";
import { postDecommissionTenant } from "../controllers/tenant/postDecommissionTenant";
import { requirePlatformOperator } from "../middlewares/auth";
import { permifyGuard } from "../middlewares/permifyGuard"; // W12-B5P1DF

const router = Router();

router.route("/").post(permifyGuard("onboarding_workflow", "create"), postCreateTenant);
// PL-02: tenant offboarding — platform-operator role only.
router.route("/:id/decommission").post(permifyGuard("onboarding_workflow", "decommission"), requirePlatformOperator, postDecommissionTenant);

export default router;
