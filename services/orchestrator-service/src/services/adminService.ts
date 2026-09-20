import axios, { AxiosInstance } from "axios";
import { createSecureHttpsAgent } from "../lib/secureHttpsAgent";
import { readEnv } from "../config/readEnv.config";
import { IAdminProfilePayload } from "../types/admin";
import { serviceAuthClient } from "../lib/serviceAuthClient";

class AdminService {
  private _axiosInstance: AxiosInstance;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: readEnv("ADMIN_SVC_URL"),
      headers: {
        "content-type": "application/json",
      },
      httpsAgent: createSecureHttpsAgent(),
    });
  }

  public async createAdminProfile(payload: IAdminProfilePayload) {
    try {
      const body = {
        firstName: payload.first_name,
        lastName: payload.last_name,
        email: payload.email,
        phone: payload.phone,
        uin: payload.uin,
        keycloakId: payload.keycloak_id,
        platformRole: payload.platform_role,
        tenantRole: payload.tenant_role,
        branchId: payload.branch_id,
      };
      console.log("[adminService.createAdminProfile] sending to admin-service:", JSON.stringify(body));
      await this._axiosInstance.post("/admin", body, {
        headers: {
          "x-tenant-id": payload.tenant_id,
          // OB-03: service-to-service bearer (role="service")
          "Authorization": serviceAuthClient.getAuthHeader(payload.tenant_id),
        },
      });
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          error.response.data?.message ?? "Admin profile creation failed",
        );
      }
      throw new Error("Network error — admin service unreachable");
    }
  }

  public async saveAdminKycState(
    kyc_url: string,
    tenant_id: string,
    keycloak_id: string,
  ) {
    try {
      await this._axiosInstance.post(
        `/admin/kyc/save`,
        {
          kyc_url: kyc_url,
        },
        {
          headers: {
            "x-tenant-id": tenant_id,
            "x-keycloak-id": keycloak_id,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
          },
        },
      );
    } catch (error: any) {
      // Fail gracefully.
    }
  }

  public async markKycComplete(tenant_id: string, keycloak_id: string) {
    try {
      await this._axiosInstance.post(
        `/admin/kyc/complete`,
        {},
        {
          headers: {
            "x-tenant-id": tenant_id,
            "x-keycloak-id": keycloak_id,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
          },
        },
      );
    } catch (error: any) {
      // OB-06: KYC completion must not fail silently — throw so the workflow
      // retries/fails instead of leaving a pending-forever admin record.
      if (error.response) {
        throw new Error(error.response.data?.message ?? "Mark admin KYC complete failed");
      }
      throw new Error("Network error — admin service unreachable");
    }
  }
}

export const adminService = new AdminService();
