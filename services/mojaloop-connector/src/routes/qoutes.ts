import express from "express";
import { create_quote, quote_error_callback, quote_put_callback } from "../controllers";
import { authenticateRequest } from "../middlewares/auth";

const router = express.Router();

router.route("/:quote_id/error").put(quote_error_callback);
router.route("/:quote_id").put(quote_put_callback);
// W12-B5-P0-A: quote creation moves money — it was anonymous; now requires verified JWT / service token.
// (The PUT handlers above are switch callbacks, out of this batch's scope.)
router.route("/").post(authenticateRequest, create_quote);

export default router;
