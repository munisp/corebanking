import { Router } from "express";
import { postCreateTenant } from "../controllers/tenant/postCreateTenant";
import { authenticateRequest } from "../middlewares/auth";

const router = Router();

// W12-B5-P0-A: tenant provisioning is a privileged mutation — it was
// previously anonymous. Now requires a verified Keycloak JWT or the shared
// service token (see middlewares/auth.ts).
router.route("/create-tenant").post(authenticateRequest, postCreateTenant);

export default router;
