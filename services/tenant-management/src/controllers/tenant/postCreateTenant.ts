import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { PostCreateTenantSchema, validateRequest } from "../../validations";
import { tenantRepository } from "../../repositories/tenantRepository";
import { BillingPlan } from "../../utils/enums";
import logger from "../../config/logger.config";

export const postCreateTenant = asyncHandler(async (req, res) => {
  try {
    logger.info("[postCreateTenant] Received request", {
      body: req.body,
      tenantId: req.headers["x-tenant-id"],
    });

    const payload = validateRequest(PostCreateTenantSchema, req.body);
    const tenantId = req.headers["x-tenant-id"] as string;

    logger.info("[postCreateTenant] Validated payload", {
      tenantId,
      plan: payload?.plan,
    });

    const tenant = await tenantRepository.createTenant({ ...payload, tenantId });
    logger.info("[postCreateTenant] Tenant created successfully", {
      tenantId,
      tenantName: tenant?.name,
    });

    const plan = payload?.plan || BillingPlan.STANDARD;
    logger.info("[postCreateTenant] Creating billing profile", {
      tenantId,
      plan,
    });

    const billingProfile = await tenantRepository.createBillingProfile(tenantId, plan);
    logger.info("[postCreateTenant] Billing profile created successfully", {
      tenantId,
      profileKeys: Object.keys(billingProfile || {}),
    });

    return res.status(httpStatus.CREATED).json({
      status: "success",
      tenant,
      billingProfile,
    });
  } catch (error: any) {
    logger.error("[postCreateTenant] Request failed", {
      tenantId: req.headers["x-tenant-id"],
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStatus: error?.status,
      errorResponse: error?.response,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      stack: error?.stack,
    });
    throw error;
  }
});
