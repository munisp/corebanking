import { Router } from "express";
import { getCustomer } from "../controllers/customer/getCustomer";
import { postCreateCustomer } from "../controllers/customer/postCreateCustomer";
import { postCustomerPin } from "../controllers/customer/postCustomerPin";
import { putUpdateCustomer } from "../controllers/customer/putUpdateCustomer";
import { postKycCallback } from "../controllers/kyc/postKycCallback";
import { permifyGuard } from "../middlewares/permifyGuard"; // W12-B5P1DF

const router = Router();

router.route("/").post(permifyGuard("onboarding_workflow", "create"), postCreateCustomer);
router.route("/kyc/callback").post(postKycCallback);
router.route("/:id/pin").post(postCustomerPin);
router.route("/:id").get(getCustomer).put(putUpdateCustomer);

export default router;
