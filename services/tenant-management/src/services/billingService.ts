import { HttpMethod } from "@dapr/dapr";
import { readEnv } from "../config/readEnv.config";
import { daprClient } from "../lib/daprClient";
import { IGetBillingInfoResponse, IBillingProfile } from "../types/billing";
import logger from "../config/logger.config";

class BillingService {
  // cast the key to any to satisfy the typed readEnv signature for custom env keys
  private APP_ID: string = readEnv(("BILLING_SERVICE_APP_ID" as any)) as string;

  async createBillingProfile(tenantId: string, plan: string) {
    try {
      logger.info("[BillingService] Creating billing profile", {
        tenantId,
        plan,
        appId: this.APP_ID,
      });

      const response = await daprClient.invoke(
        this.APP_ID,
        "billing",
        HttpMethod.PUT,
        { plan: plan },
        {
          "x-tenant-id": tenantId,
        }
      );

      logger.info("[BillingService] Billing profile created successfully", {
        tenantId,
        responseKeys: Object.keys(response || {}),
      });

      const { billing_profile } = response as { billing_profile: IBillingProfile };
      return billing_profile;
    } catch (error: any) {
      logger.error("[BillingService] Failed to create billing profile", {
        tenantId,
        plan,
        appId: this.APP_ID,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorStatus: error?.status,
        errorResponse: error?.response,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        stack: error?.stack,
      });
      throw error;
    }
  }

  async getBillingInfo(tenantId: string) {
    try {
      logger.info("[BillingService] Fetching billing info", {
        tenantId,
        appId: this.APP_ID,
      });

      const response = await daprClient.invoke(
        this.APP_ID,
        "billing/info",
        HttpMethod.GET,
        {},
        {
          "x-tenant-id": tenantId,
        }
      );

      logger.info("[BillingService] Billing info fetched successfully", {
        tenantId,
        responseKeys: Object.keys(response || {}),
      });

      const { billing_info } = response as { billing_info: IGetBillingInfoResponse };
      return billing_info;
    } catch (error: any) {
      logger.error("[BillingService] Failed to fetch billing info", {
        tenantId,
        appId: this.APP_ID,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorStatus: error?.status,
        errorResponse: error?.response,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        stack: error?.stack,
      });
      throw error;
    }
  }
}

export const billingService = new BillingService();