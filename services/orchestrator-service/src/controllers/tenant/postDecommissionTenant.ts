import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { ApiError } from "../../middlewares/error";
import { workflowRunner } from "../../utils/workflowRunner";
import { decommissionTenantWorkflow } from "../../workflows/decommissionTenantWorkflow";

// PL-02: tenant offboarding entrypoint. Restricted to platform operators by
// requirePlatformOperator (see routes/tenantRoute.ts). Starts the
// decommissionTenantWorkflow: revoke sessions → delete realm → suspend the
// tenant record → publish a tombstone event.
export const postDecommissionTenant = asyncHandler(async (req, res) => {
  const tenantId = req.params.id;
  if (!tenantId || typeof tenantId !== "string") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Tenant ID is required.");
  }

  await workflowRunner(decommissionTenantWorkflow, {
    args: { tenantId },
    // Deterministic id: a tenant can only be decommissioned once per run.
    workflowId: `54link_decommission_tenant_${tenantId}`,
    defaultErrorMessage: "Tenant decommission failed.",
    withTimeOut: 40000,
    timeOutFn: () => {
      return res.status(httpStatus.ACCEPTED).json({
        isSuccessful: true,
        message: "Tenant decommission processing... You'll be notified when it's done.",
        responseModel: {},
      });
    },
  });

  return res
    .status(httpStatus.OK)
    .json({ message: `Tenant ${tenantId} decommissioned.` });
});
