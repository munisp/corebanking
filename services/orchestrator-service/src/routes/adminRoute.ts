import { Router } from "express";
import { postKycCallback } from "../controllers/kyc/postKycCallback";
import { postCreateAdmin } from "../controllers/admin/postCreateAdmin";
import { permifyGuard } from "../middlewares/permifyGuard"; // W12-B5P1DF

const router = Router();

router.route("/").post(permifyGuard("onboarding_workflow", "create"), postCreateAdmin);
router.route("/kyc/callback").post(postKycCallback);

export default router;
