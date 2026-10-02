import { Router } from "express";
import { postCreateTenantEmployee } from "../controllers/employee/postCreateTenantEmployee";

// OB-14: employee onboarding route (wired to createEmployeeWorkflow).
const router = Router();

router.route("/").post(postCreateTenantEmployee);

export default router;
