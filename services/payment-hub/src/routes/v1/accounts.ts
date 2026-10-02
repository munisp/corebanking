import express from "express";
import { v1 } from "../../controllers";
import { authenticateRequest } from "../../middlewares/auth";

const router = express.Router();

// W12-B5-P0-A: account creation was anonymous — now requires verified JWT / service token.
router.route("/").post(authenticateRequest, v1.create_account);
router.route("/sub").post(authenticateRequest, v1.create_sub_account);

export default router;
