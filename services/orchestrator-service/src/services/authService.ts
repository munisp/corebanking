import axios, { AxiosInstance } from "axios";
import { createSecureHttpsAgent } from "../lib/secureHttpsAgent";
import { readEnv } from "../config/readEnv.config";
import {
  IAuthProfilePayload,
  IAuthProfileResponse,
  ISetupPassword,
} from "../types/auth";
import { serviceAuthClient } from "../lib/serviceAuthClient";

class AuthService {
  private _axiosInstance: AxiosInstance;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: readEnv("AUTH_SVC_URL"),
      headers: {
        "content-type": "application/json",
      },
      httpsAgent: createSecureHttpsAgent(),
    });
  }

  public async createAuthProfile(
    payload: IAuthProfilePayload,
  ): Promise<IAuthProfileResponse> {
    try {
      const response = await this._axiosInstance.post(
        "/auth",
        {
          email: payload.email,
          user_role: payload.user_role,
          platform_role: payload.platform_role, // v2.perm platform entity role
          tenant_role: payload.tenant_role, // v2.perm tenants entity role
        },
        {
          headers: {
            "x-tenant-id": payload.tenant_id,
            "x-keycloak-realm": payload.keycloak_realm,
            "x-keycloak-pub-key": payload.keycloak_pub_key,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(payload.tenant_id),
          },
        },
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message ?? "Authentication profile creation failed";
        const errorCode = error.response.data?.code ?? "UNKNOWN";
        const statusCode = error.response.status;
        
        // Log detailed error information for debugging
        console.error("Auth profile creation error:", {
          email: payload.email,
          tenant_id: payload.tenant_id,
          status: statusCode,
          code: errorCode,
          message: errorMessage,
          fullError: JSON.stringify(error.response.data),
        });
        
        throw new Error(`${errorMessage} (Status: ${statusCode}, Code: ${errorCode})`);
      }
      console.error("Network error creating auth profile:", error.message);
      throw new Error("Network error — authentication service unreachable");
    }
  }

  public async setupPassword(payload: ISetupPassword): Promise<void> {
    try {
      const response = await this._axiosInstance.post(
        "/auth/setup-password",
        {
          keycloak_id: payload.keycloak_id,
          password: payload.password,
          confirm_password: payload.confirm_password,
        },
        {
          headers: {
            "x-tenant-id": payload.tenant_id,
            "x-keycloak-realm": payload.keycloak_realm,
            "x-keycloak-pub-key": payload.keycloak_pub_key,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(payload.tenant_id),
          },
        },
      );
      return;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message ?? "Password setup failed";
        const errorCode = error.response.data?.code ?? "UNKNOWN";
        const statusCode = error.response.status;
        
        console.error("Password setup error:", {
          keycloak_id: payload.keycloak_id,
          tenant_id: payload.tenant_id,
          status: statusCode,
          code: errorCode,
          message: errorMessage,
        });
        
        throw new Error(`${errorMessage} (Status: ${statusCode}, Code: ${errorCode})`);
      }
      console.error("Network error setting up password:", error.message);
      throw new Error("Network error — authentication service unreachable");
    }
  }
  /**
   * OB-08 (saga compensation): best-effort delete of a previously created auth
   * profile. NOTE: auth-service @ 1c9134e2 exposes no DELETE endpoint (only
   * POST /auth, /login, /setup-password, /forgot-password, /reset-password,
   * /change-password) — this calls DELETE /auth/{keycloak_id} which R1B must
   * add. Until then a 404/405 is logged as CRITICAL for manual cleanup and
   * not rethrown (compensation must never mask the original failure).
   */
  public async deleteAuthProfile(
    tenant_id: string,
    keycloak_id: string,
    keycloak_realm: string,
  ): Promise<void> {
    try {
      await this._axiosInstance.delete(`/auth/${keycloak_id}`, {
        headers: {
          "x-tenant-id": tenant_id,
          "x-keycloak-realm": keycloak_realm,
          // OB-03: service-to-service bearer (role="service")
          "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
        },
      });
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 404 || status === 405) {
        console.error(
          `[authService.deleteAuthProfile] CRITICAL: auth-service has no delete endpoint yet (HTTP ${status}); orphaned auth profile keycloak_id=${keycloak_id} tenant=${tenant_id} requires manual cleanup`,
        );
        return;
      }
      console.error(
        `[authService.deleteAuthProfile] compensation failed keycloak_id=${keycloak_id}: ${error.message}`,
      );
      // Best-effort: never throw from a compensation.
    }
  }
}

export const authService = new AuthService();
