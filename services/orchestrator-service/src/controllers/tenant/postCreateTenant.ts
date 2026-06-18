import { uuid4 } from "@temporalio/workflow";
import { asyncHandler } from "../../middlewares/async";
import { workflowRunner } from "../../utils/workflowRunner";
import { validateRequest } from "../../validations";
import { createTenantWorkflow } from "../../workflows/createTenantWorkflow";
import httpStatus from "http-status";
import { generateSlug } from "../../utils";
import { CreateTenantSchema } from "../../validations/schemas";
import logger from "../../config/logger.config";

export const postCreateTenant = asyncHandler(async (req, res) => {
  logger.info(`[postCreateTenant] Received request to create tenant`, {
    payloadKeys: Object.keys(req.body),
    contentType: req.headers['content-type'],
  });
  
  const payload = validateRequest(CreateTenantSchema, req.body);
  logger.info(`[postCreateTenant] Validated payload`, {
    name: payload.name,
    type: payload.type,
    hasContact: !!payload.contact,
  });

  const tenantId = generateSlug(payload.name);
  const ledgerId = "1"; // Default ledger ID for new tenants
  const workflowId = `54link_create_tenant_${tenantId}_${uuid4()}`;

  logger.info(`[postCreateTenant] Starting tenant creation workflow`, {
    tenantId,
    ledgerId,
    workflowId,
    contactEmail: payload.contact?.email,
  });

  try {
    const tenant = await workflowRunner(createTenantWorkflow, {
      args: { ...payload, tenantId, ledgerId },
      workflowId,
      defaultErrorMessage: "Tenant creation failed.",
      withTimeOut: 40000,
      timeOutFn: () => {
        logger.info(`[postCreateTenant] Workflow timeout reached for ${workflowId}`);
        return res.status(httpStatus.ACCEPTED).json({
          isSuccessful: true,
          message: "Tenant creation processing... You'll be notified when it's done.",
          responseModel: {},
        });
      },
    });

    logger.info(`[postCreateTenant] Successfully created tenant`, {
      tenantId,
      workflowId,
    });

    return res.status(httpStatus.CREATED).json({ message: "success", tenant });
  } catch (error: any) {
    logger.error(`[postCreateTenant] Failed to create tenant`, {
      tenantId,
      workflowId,
      error: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    throw error;
  }
});
