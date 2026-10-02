import express from "express";
import { v1 } from "../../controllers";
import { authenticateRequest } from "../../middlewares/auth";

const router = express.Router();

// W12-B5-P0-A: party lookup (PII) was anonymous — now requires verified JWT / service token.
router.route("/lookup").post(authenticateRequest, v1.lookup_party);

export default router;
