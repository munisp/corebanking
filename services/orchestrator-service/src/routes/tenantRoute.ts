import { Router } from "express";
import { postCreateTenant } from "../controllers/tenant/postCreateTenant";
import { postDecommissionTenant } from "../controllers/tenant/postDecommissionTenant";
import { requirePlatformOperator } from "../middlewares/auth";

const router = Router();

router.route("/").post(postCreateTenant);
// PL-02: tenant offboarding — platform-operator role only.
router.route("/:id/decommission").post(requirePlatformOperator, postDecommissionTenant);

export default router;
