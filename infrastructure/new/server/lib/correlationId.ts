/**
 * G7: Request correlation ID propagation across all services.
 * Generates a unique ID per request, passes it through proxy calls,
 * and includes it in all log entries and error responses.
 */

import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

const HEADER_NAME = "x-correlation-id";

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers[HEADER_NAME] as string) || randomUUID();
  req.headers[HEADER_NAME] = correlationId;
  res.setHeader(HEADER_NAME, correlationId);
  next();
}

export function getCorrelationId(req: Request): string {
  return (req.headers[HEADER_NAME] as string) || "unknown";
}
