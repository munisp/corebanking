import { Router } from "express";
import httpStatus from "http-status";

const router = Router();

router.get("/", (_req, res) => {
  res.status(httpStatus.OK).json({ status: "ok", service: "billing-service", timestamp: new Date().toISOString() });
});

export default router;
