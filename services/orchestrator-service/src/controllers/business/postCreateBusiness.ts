import { uuid4 } from "@temporalio/workflow";
import { asyncHandler } from "../../middlewares/async";
import { workflowRunner } from "../../utils/workflowRunner";
import { validateRequest } from "../../validations";
import { createBusinessWorkflow } from "../../workflows/createBusinessWorkflow";
import httpStatus from "http-status";
import { ApiError } from "../../middlewares/error";
import { CreateBusinessSchema } from "../../validations/schemas";
import { tenantService } from "../../services/tenantService";

export const postCreateBusiness = asyncHandler(async (req, res) => {
  const payload = validateRequest(CreateBusinessSchema, req.body);

  const tenantId = req.headers["x-tenant-id"] as string;
  const keycloakRealm = "54link_" + tenantId;
  const keycloakPublicKey = await tenantService.getKeycloakPublicKey(tenantId);

  if (!tenantId) throw new ApiError(httpStatus.BAD_REQUEST, "Tenant ID is required.");

  const verification = await workflowRunner(createBusinessWorkflow, {
    args: { ...payload, tenantId, keycloakRealm, keycloakPublicKey },
    workflowId: `54link_create_business_${tenantId}_${payload.email}_${uuid4()}`,
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