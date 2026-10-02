/**
 * W12-C3-P2-MLIB: route/persistence support helpers for the PG-authoritative
 * lib store conversions (c3-0963 … c3-1039).
 *
 * - asyncRoute: Express 4 does not forward rejected promises from async
 *   handlers to the error middleware (client hangs). Wrap async handlers so
 *   rejections reach globalErrorHandler via next(err) — same contract as
 *   index.ts's asyncHandler, shared here for the lib registerXxx modules.
 * - pgGuard: fail-closed translation. When the Postgres pool is unavailable
 *   (pgJsonStore's exec/ensureTables throw "pg-store: database unavailable"),
 *   the request fails with 503 PERSISTENCE_UNAVAILABLE. There is NO
 *   degraded-memory fallback: these stores are Postgres-authoritative —
 *   serving stale in-process copies of business records after a restart is
 *   exactly the defect this wave removes. Non-availability errors (constraint
 *   violations, etc.) propagate unchanged to the global error handler (500).
 */
import type { NextFunction, Request, Response } from "express";

import { AppError } from "./errorHandler";

export function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export async function pgGuard<T>(op: Promise<T>): Promise<T> {
  try {
    return await op;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("pg-store: database unavailable")) {
      throw new AppError("persistence unavailable", 503, "PERSISTENCE_UNAVAILABLE");
    }
    throw err;
  }
}
