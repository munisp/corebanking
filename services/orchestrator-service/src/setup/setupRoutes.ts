import { Application } from "express";
import adminRoute from "../routes/adminRoute";
import agentRoute from "../routes/agentRoute";
import businessRoute from "../routes/businessRoutes";
import customerRoute from "../routes/customerRoute";
import employeeRoute from "../routes/employeeRoute";
import healthCheckRoute from "../routes/healthCheckRoute";
import notificationRoute from "../routes/notificationRoute";
import rewardRoute from "../routes/rewardRoute";
import tenantRoute from "../routes/tenantRoute";
import { authenticateRequest } from "../middlewares/auth";

export default function setupRoutes(app: Application): void {
  app.use("/health", healthCheckRoute);
  // OB-01: every onboarding entrypoint requires a verified platform JWT or the
  // shared service token; KYC/KYB callbacks require the HMAC callback
  // signature (dispatched inside authenticateRequest).
  app.use("/admin", authenticateRequest, adminRoute);
  app.use("/business", authenticateRequest, businessRoute);
  app.use("/customer", authenticateRequest, customerRoute);
  app.use("/agent", authenticateRequest, agentRoute);
  app.use("/tenant", authenticateRequest, tenantRoute);
  // OB-14: mount the previously-unwired employee onboarding route.
  app.use("/employee", authenticateRequest, employeeRoute);
  // Customer console: in-app notification inbox and rewards ledger.
  app.use("/notifications", authenticateRequest, notificationRoute);
  app.use("/rewards", authenticateRequest, rewardRoute);
}
