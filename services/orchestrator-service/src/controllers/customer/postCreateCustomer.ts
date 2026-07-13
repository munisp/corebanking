import { uuid4 } from "@temporalio/workflow";
import { asyncHandler } from "../../middlewares/async";
import { workflowRunner } from "../../utils/workflowRunner";
import { validateRequest } from "../../validations";
import { createCustomerWorkflow } from "../../workflows/createCustomerWorkflow";
import httpStatus from "http-status";
import { ApiError } from "../../middlewares/error";
import { CreateCustomerSchema } from "../../validations/schemas";
import { tenantService } from "../../services/tenantService";

export const postCreateCustomer = asyncHandler(async (req, res) => {
  const payload = validateRequest(CreateCustomerSchema, req.body);

  const tenantId = req.headers["x-tenant-id"] as string;
  if (!tenantId) throw new ApiError(httpStatus.BAD_REQUEST, "Tenant ID is required.");

  const keycloakRealm = "54link_" + tenantId;
  const [keycloakPublicKey, ledgerId] = await Promise.all([
    tenantService.getKeycloakPublicKey(tenantId),
    tenantService.getLedgerId(tenantId),
  ]);

  const verification = await workflowRunner(createCustomerWorkflow, {
    args: { ...payload, tenantId, keycloakRealm, keycloakPublicKey, ledgerId },
    workflowId: `54link_create_customer_${tenantId}_${payload.email}_${uuid4()}`,
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
