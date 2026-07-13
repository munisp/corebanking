import { Application } from "express";
import healthCheckRoutes from "../routes/healthCheckRoute";
import metricsRoutes from "../routes/metricsRoute";
import billingRoutes from "../routes/v1/billing";
import billingEventProcessorRoutes from "../routes/v1/billingEventProcessor";

export default function setupRoutes(app: Application): void {
  app.use("/health", healthCheckRoutes);
  app.use("/metrics", metricsRoutes);
  app.use("/billing", billingRoutes);
  app.use("/billing-event-processor", billingEventProcessorRoutes);
}
