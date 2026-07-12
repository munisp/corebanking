import { uuid4 } from "@temporalio/workflow";
import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { ApiError } from "../../middlewares/error";
import { tenantService } from "../../services/tenantService";
import { workflowRunner } from "../../utils/workflowRunner";
import { validateRequest } from "../../validations";
import { CreateEmployeeSchema } from "../../validations/schemas";
import { createEmployeeWorkflow } from "../../workflows/createEmployeeWorkflow";

export const postCreateTenantEmployee = asyncHandler(async (req, res) => {
  const payload = validateRequest(CreateEmployeeSchema, req.body);

  const tenantId = req.headers["x-tenant-id"] as string;
  if (!tenantId) throw new ApiError(httpStatus.BAD_REQUEST, "Tenant ID is required.");

  const keycloakRealm = "54link_" + tenantId;
  const [keycloakPublicKey, ledgerId] = await Promise.all([
    tenantService.getKeycloakPublicKey(tenantId),
    tenantService.getLedgerId(tenantId),
  ]);

  const verification = await workflowRunner(createEmployeeWorkflow, {
    args: { ...payload, tenantId, keycloakRealm, keycloakPublicKey, ledgerId },
    workflowId: `54link_create_tenant_employee_${tenantId}_${uuid4()}`,
    defaultErrorMessage: "Employee creation failed.",
    withTimeOut: 40000,
    timeOutFn: () => {
      return res.status(httpStatus.ACCEPTED).json({
        isSuccessful: true,
        message: "Employee creation processing... You'll be notified when it's done.",
        responseModel: {},
      });
    },
  });

  return res.status(httpStatus.CREATED).json({ message: "success", verification });
});
