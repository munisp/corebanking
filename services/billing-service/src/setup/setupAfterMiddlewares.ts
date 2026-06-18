import { type Application, Request, Response, NextFunction } from "express";
import logger from "../config/logger.config";
import httpStatus from "http-status";

export default function setupAfterMiddlewares(app: Application): void {
  app.use((_req: Request, res: Response) => {
    res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Route not found" });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("[billing-service] Unhandled error", { error: err?.message });
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  });
}
