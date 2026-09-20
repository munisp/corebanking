import { type Application } from "express";
import morgan_config from "../config/morgan.config";
import { tenantMiddleware } from "../otel/tenant";

export default function setupBeforeMiddlewares(app: Application): void {
  app.use(morgan_config);
  // SPEC §2.3: attach tenant.id (x-tenant-id header -> JWT claim) to the active span.
  app.use(tenantMiddleware);
}
