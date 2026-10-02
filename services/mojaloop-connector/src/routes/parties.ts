import express from "express";
import * as controllers from "../controllers";
import { authenticateRequest } from "../middlewares/auth";

const router = express.Router();

// W12-B5-P0-A: payee lookup was anonymous — now requires verified JWT / service token.
router.route("/lookup").post(authenticateRequest, controllers.lookup_party);
router.route("/:identifier_type/:identifier/error").put(controllers.put_party_error);
router.route("/:identifier_type/:identifier").put(controllers.put_lookup_party);

export default router;
