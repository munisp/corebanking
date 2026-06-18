import type { ErrorRequestHandler } from "express";

import { logger } from "./logger";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const globalErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = res.getHeader("x-request-id") as string | undefined;
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";

  logger.error("Unhandled request error", {
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    code,
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });

  if (!res.headersSent) {
    res.status(statusCode).json({
      error: {
        message: process.env.NODE_ENV === "production" && statusCode === 500
          ? "Internal server error"
          : err.message,
        code,
        requestId,
      },
    });
  }
};
