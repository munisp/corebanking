import { Application } from "express";
import healthCheckRoute    from "../routes/healthCheckRoute";
import clientRoute         from "../routes/clientRoute";
import kycRoute            from "../routes/kycRoute";
import kybRoute            from "../routes/kybRoute";
import verificationRoute   from "../routes/verificationRoute";

export default function setupRoutes(app: Application): void {
  app.use("/health",  healthCheckRoute);
  app.use("/clients", clientRoute);
  app.use("/kyc",     kycRoute);
  app.use("/kyb",     kybRoute);
  // Step-by-step verification flow (new UI endpoints)
  app.use("/api/v1",  verificationRoute);
}
