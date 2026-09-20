import { asyncHandler } from "../../middlewares/async";
import { resolveTenantId } from "../../middlewares/auth";
import { workflowRunner } from "../../utils/workflowRunner";
import { validateRequest } from "../../validations";
import { createBusinessWorkflow } from "../../workflows/createBusinessWorkflow";
import httpStatus from "http-status";
import { CreateBusinessSchema } from "../../validations/schemas";
import { tenantService } from "../../services/tenantService";

export const postCreateBusiness = asyncHandler(async (req, res) => {
  const payload = validateRequest(CreateBusinessSchema, req.body);

  // OB-01 + ordering fix: establish the tenant from the authenticated caller
  // BEFORE calling getKeycloakPublicKey (previously the public key was fetched
  // with a possibly-undefined tenantId, and the missing-tenant check ran after).
  const tenantId = resolveTenantId(req, res);

  const keycloakRealm = "54link_" + tenantId;
  const keycloakPublicKey = await tenantService.getKeycloakPublicKey(tenantId);

  const verification = await workflowRunner(createBusinessWorkflow, {
    args: { ...payload, tenantId, keycloakRealm, keycloakPublicKey },
    // OB-08: deterministic workflow id for Temporal-side dedup.
    workflowId: `54link_create_business_${tenantId}_${payload.email}`,
    defaultErrorMessage: "Create business failed.",
    withTimeOut: 40000,
    timeOutFn: () => {
      return res.status(httpStatus.ACCEPTED).json({
        isSuccessful: true,
        message: "Create business processing... You’ll be notified when it’s done.",
        responseModel: {},
      });
    },
  });

  console.log("workflow response", verification);

  return res.status(httpStatus.CREATED).json({ message: "success", verification });
});