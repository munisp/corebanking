import { Router } from "express";
import { postCreateBusiness } from "../controllers/business/postCreateBusiness";
import { postKybCallback }     from "../controllers/kyb/postKybCallback";
import { permifyGuard } from "../middlewares/permifyGuard"; // W12-B5P1DF

const router = Router();

router.route("/").post(permifyGuard("onboarding_workflow", "create"), postCreateBusiness);
router.route("/kyb/callback").post(postKybCallback);

export default router;