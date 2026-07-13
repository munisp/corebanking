import express from "express";
import { v1 } from "../../controllers";

const router = express.Router();

router.route("/initiate").post(v1.initiate_transfer);
router.route("/fund").post(v1.fund);
router.route("/reverse").post(v1.reverse_transfer);
router.route("/approval-callback").post(v1.approval_callback);

export default router;
