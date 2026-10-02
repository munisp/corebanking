import express from "express";
import { v1 } from "../../controllers";
import { authenticateRequest } from "../../middlewares/auth";

const router = express.Router();

// W12-B5-P0-A: card payment initiation was anonymous — now requires verified JWT / service token.
router.route("/process-payment").post(authenticateRequest, v1.process_card_payment);

export default router;
