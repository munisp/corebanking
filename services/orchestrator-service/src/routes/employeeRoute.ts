import { Router } from "express";
import { postCreateTenantEmployee } from "../controllers/employee/postCreateTenantEmployee";
import { permifyGuard } from "../middlewares/permifyGuard"; // W12-B5P1DF

// OB-14: employee onboarding route (wired to createEmployeeWorkflow).
const router = Router();

router.route("/").post(permifyGuard("onboarding_workflow", "create"), postCreateTenantEmployee);

export default router;
