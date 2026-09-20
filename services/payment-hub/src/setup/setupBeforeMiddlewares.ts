import { type Application } from "express";
import morgan_config from "../config/morgan.config";
import record_request from "../middlewares/recordRequest";
import { tenantMiddleware } from "../otel/tenant";

export default function setupBeforeMiddlewares(app: Application): void {
  app.use(morgan_config);
  app.use(record_request);
  // SPEC §2.3: attach tenant.id (x-tenant-id header -> JWT claim) to the active span.
  // payment-hub has no app-level auth middleware; the per-route tenant gate is
  // extract_custom_headers (routes/v1). This middleware only reads headers/claims.
  app.use(tenantMiddleware);
}
