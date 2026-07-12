import type { RequestHandler } from "express";

import { logger } from "./logger";

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  const requestId = res.getHeader("x-request-id") as string | undefined;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level](`${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  });

  next();
};
