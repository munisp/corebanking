import { NextFunction, Request, Response } from "express";
import logger from "../config/logger.config";
import httpStatus from "http-status";

export const asyncHandler =
  <T>(fn: (req: Request, res: Response<T>, next: NextFunction) => void) =>
  (req: Request, res: Response, _next: NextFunction) =>
    Promise.resolve(fn(req, res, _next)).catch((err: any) => {
      const statusCode = err?.statusCode || err?.status || httpStatus.INTERNAL_SERVER_ERROR;
      const message = err?.message || "An unexpected error occurred.";
      logger.error(`[billing-service] ${req.method} ${req.path} — ${message}`);
      return res.status(statusCode).json({ success: false, message });
    });
