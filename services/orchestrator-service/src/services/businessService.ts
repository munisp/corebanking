import axios, { AxiosInstance } from "axios";
import { createSecureHttpsAgent } from "../lib/secureHttpsAgent";
import { readEnv } from "../config/readEnv.config";
import logger from "../config/logger.config";
import { serviceAuthClient } from "../lib/serviceAuthClient";

class BusinessService {
  private _axiosInstance: AxiosInstance;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: readEnv("BUSINESS_SVC_URL"),
      headers: { "content-type": "application/json" },
      httpsAgent: createSecureHttpsAgent(),
    });
  }

  public async createBusinessRecord(payload: {
    tenant_id:   string;
    keycloak_id: string;
    name:        string;
    registration_number: string;
    business_type:       string;
    phone_number?:       string;
    email_address?:      string;
    headquarters_address?: string;
    headquarters_location?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      logger.info(`[businessService] createBusinessRecord — tenant_id=${payload.tenant_id} keycloak_id=${payload.keycloak_id} name=${payload.name}`);
      const response = await this._axiosInstance.post(
        `/api/v1/businesses`,
        {
          name:                    payload.name,
          registration_number:     payload.registration_number,
          business_type:           payload.business_type,
          phone_number:            payload.phone_number,
          email_address:           payload.email_address,
          headquarters_address:    payload.headquarters_address,
          headquarters_location:   payload.headquarters_location,
          metadata:                payload.metadata,
        },
        {
          headers: {
            "x-tenant-id":       payload.tenant_id,
            "x-keycloak-id":     payload.keycloak_id,
            "x-keycloak-realm":  `54link_${payload.tenant_id}`,
            // OB-03: service-to-service bearer (role="service")
            "Authorization":     serviceAuthClient.getAuthHeader(payload.tenant_id),
          },
        },
      );
      logger.info(`[businessService] createBusinessRecord done — id=${response.data?.id}`);
      return response.data;
    } catch (error: any) {
      const detail = error.response
        ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
        : error.message;
      logger.error(`[businessService] createBusinessRecord failed — ${detail}`);
      throw error;
    }
  }

  public async markKybComplete(tenant_id: string, keycloak_id: string) {
    try {
      logger.info(`[businessService] markKybComplete — tenant_id=${tenant_id} keycloak_id=${keycloak_id}`);
      await this._axiosInstance.post(
        `/business/kyb/complete`,
        {},
        {
          headers: {
            "x-tenant-id":    tenant_id,
            "x-keycloak-id":  keycloak_id,
            // OB-03: service-to-service bearer (role="service")
            "Authorization":  serviceAuthClient.getAuthHeader(tenant_id),
          },
        },
      );
      logger.info(`[businessService] markKybComplete done`);
    } catch (error: any) {
      const detail = error.response
        ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
        : error.message;
      logger.error(`[businessService] markKybComplete failed — ${detail}`);
      // OB-05: do NOT swallow — KYB completion must persist or the caller must
      // see the failure. Throw so the callback returns an error and retries.
      throw new Error(`Mark KYB complete failed: ${detail}`);
    }
  }
}

export const businessService = new BusinessService();
