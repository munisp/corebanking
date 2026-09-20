import { asyncHandler } from "../../middlewares/async";
import { resolveTenantId } from "../../middlewares/auth";
import { workflowRunner } from "../../utils/workflowRunner";
import { validateRequest } from "../../validations";
import { createCustomerWorkflow } from "../../workflows/createCustomerWorkflow";
import httpStatus from "http-status";
import { CreateCustomerSchema } from "../../validations/schemas";
import { tenantService } from "../../services/tenantService";

export const postCreateCustomer = asyncHandler(async (req, res) => {
  const payload = validateRequest(CreateCustomerSchema, req.body);

  // OB-01: tenant derived from the verified JWT claims; x-tenant-id is only
  // honoured for service-token callers (enforced inside resolveTenantId).
  const tenantId = resolveTenantId(req, res);

  const keycloakRealm = "54link_" + tenantId;
  const [keycloakPublicKey, ledgerId] = await Promise.all([
    tenantService.getKeycloakPublicKey(tenantId),
    tenantService.getLedgerId(tenantId),
  ]);

  const verification = await workflowRunner(createCustomerWorkflow, {
    args: { ...payload, tenantId, keycloakRealm, keycloakPublicKey, ledgerId },
    // OB-08: deterministic workflow id — Temporal dedups retries of the same
    // (tenant, email) onboarding instead of deadlocking on downstream 409s.
    workflowId: `54link_create_customer_${tenantId}_${payload.email}`,
    defaultErrorMessage: "Create customer failed.",
    withTimeOut: 40000,
    timeOutFn: () => {
      return res.status(httpStatus.ACCEPTED).json({
        isSuccessful: true,
        message: "Create customer processing... You’ll be notified when it’s done.",
        responseModel: {},
      });
    },
  });

  console.log("workflow response", verification);

  return res.status(httpStatus.CREATED).json({ message: "success", verification });
});
