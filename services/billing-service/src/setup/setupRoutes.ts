import { Application } from "express";
import healthCheckRoutes from "../routes/healthCheckRoute";
import metricsRoutes from "../routes/metricsRoute";
import billingRoutes from "../routes/v1/billing";
// W12 A4-P1-A RETIRED: billingEventProcessorRoutes (GET /billing-event-processor/v1/events)
// was a shadowed duplicate — APISIX routes /billing-event-processor/* to
// billing-event-processor-py (billing-event-processor-py.yaml), whose endpoint
// is already UI-called by BillingEventProcessorWorkspace. This copy could never
// receive gateway traffic.

export default function setupRoutes(app: Application): void {
  app.use("/health", healthCheckRoutes);
  app.use("/metrics", metricsRoutes);
  app.use("/billing", billingRoutes);
}
