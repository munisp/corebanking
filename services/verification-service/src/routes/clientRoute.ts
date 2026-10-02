import { Router } from "express";
import { postRegisterClient } from "../controllers/client/postRegisterClient";
import { getClient } from "../controllers/client/getClient";
import { authenticateClient } from "../middlewares/auth";

const router = Router();

// OB-15: client registration issues live KYC-API credentials — it must be
// authenticated. Requires valid platform-admin client credentials
// (x-client-id / x-client-secret of an existing client, e.g. the seeded
// default client). Registration is no longer anonymous.
router.route("/").post(authenticateClient, postRegisterClient);
router.route("/:id").get(getClient);

export default router;
