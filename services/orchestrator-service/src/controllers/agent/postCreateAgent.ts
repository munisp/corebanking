import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { resolveTenantId } from "../../middlewares/auth";
import { tenantService } from "../../services/tenantService";
import { workflowRunner } from "../../utils/workflowRunner";
import { validateRequest } from "../../validations";
import { CreateAgentSchema } from "../../validations/schemas";
import { createAgentWorkflow } from "../../workflows/createAgentWorkflow";

export const postCreateAgent = asyncHandler(async (req, res) => {
  const payload = validateRequest(CreateAgentSchema, req.body);

  // OB-01: tenant derived from verified token claims (see resolveTenantId).
  const tenantId = resolveTenantId(req, res);

  const keycloakRealm = "54link_" + tenantId;
  const [keycloakPublicKey, ledgerId] = await Promise.all([
    tenantService.getKeycloakPublicKey(tenantId),
    tenantService.getLedgerId(tenantId),
  ]);

  const verification = await workflowRunner(createAgentWorkflow, {
    args: { ...payload, tenantId, keycloakRealm, keycloakPublicKey, ledgerId },
    // OB-08: deterministic workflow id for Temporal-side dedup.
    workflowId: `54link_create_agent_${tenantId}_${payload.email}`,
    defaultErrorMessage: "Agent creation failed.",
    withTimeOut: 40000,
    timeOutFn: () => {
      return res.status(httpStatus.ACCEPTED).json({
        isSuccessful: true,
        message:
          "Agent creation processing... You'll be notified when it's done.",
        responseModel: {},
      });
    },
  });

  console.log("workflow response", verification);

  return res
    .status(httpStatus.CREATED)
    .json({ message: "success", verification });
});
