import axios, { AxiosInstance } from "axios";
import { createSecureHttpsAgent } from "../lib/secureHttpsAgent";
import { readEnv } from "../config/readEnv.config";
import { IUser, IUserProfilePayload, IUserProfileResponse } from "../types/user";
import { serviceAuthClient } from "../lib/serviceAuthClient";

class UserService {
  private _axiosInstance: AxiosInstance;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: readEnv("USER_SVC_URL"),
      timeout: 10000,
      headers: {
        "content-type": "application/json",
      },
      httpsAgent: createSecureHttpsAgent(),
    });
  }

  public async createUserProfile(payload: IUserProfilePayload): Promise<IUserProfileResponse> {
    try {
      const response = await this._axiosInstance.post("/user", payload, {
        headers: {
          "x-tenant-id": payload.tenant_id,
          "x-keycloak-id": payload.keycloak_id,
          // OB-03: service-to-service bearer (role="service")
          "Authorization": serviceAuthClient.getAuthHeader(payload.tenant_id),
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data?.message ?? "User profile creation failed");
      }
      throw new Error("Network error — user service unreachable");
    }
  }

  public async getUser(tenant_id: string, keycloak_id: string): Promise<IUser> {
    try {
      const response = await this._axiosInstance.get<{ user: IUser }>(`/user?keycloak_id=${keycloak_id}`, {
        headers: {
          "x-tenant-id": tenant_id,
          "x-keycloak-id": keycloak_id,
          // OB-03: service-to-service bearer (role="service")
          "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
        },
      });
      return response.data.user;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data?.message ?? "Fetch user failed");
      }
      throw new Error("Network error — user service unreachable");
    }
  }

  public async saveKycState(kyc_url: string, tenant_id: string, keycloak_id: string) {
    try {
      await this._axiosInstance.post(
        `/user/kyc/save`,
        {
          url: kyc_url,
        },
        {
          headers: {
            "x-tenant-id": tenant_id,
            "x-keycloak-id": keycloak_id,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
          },
        }
      );
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data?.message ?? "Save KYC state failed");
      }
      throw new Error("Network error — user service unreachable");
    }
  }

  public async markKycComplete(tenant_id: string, keycloak_id: string) {
    try {
      await this._axiosInstance.post(
        `/user/kyc/complete`,
        {},
        {
          headers: {
            "x-tenant-id": tenant_id,
            "x-keycloak-id": keycloak_id,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
          },
        }
      );
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data?.message ?? "Mark KYC complete failed");
      }
      throw new Error("Network error — user service unreachable");
    }
  }

  public async assignTier(tenant_id: string, keycloak_id: string, tier: number) {
    try {
      await this._axiosInstance.post(
        `/user/tier/assign`,
        { tier },
        {
          headers: {
            "x-tenant-id": tenant_id,
            "x-keycloak-id": keycloak_id,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
          },
        }
      );
    } catch {
      // Fail gracefully.
    }
  }

  public async markKycFail(tenant_id: string, keycloak_id: string) {
    try {
      await this._axiosInstance.post(
        `/user/kyc/fail`,
        {},
        {
          headers: {
            "x-tenant-id": tenant_id,
            "x-keycloak-id": keycloak_id,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
          },
        }
      );
    } catch (error: any) {
      // Fail gracefully.
    }
  }

  // Update a user profile by user-service's internal user id (PUT /user/{id}).
  public async updateUserById(
    tenant_id: string,
    keycloak_id: string,
    user_id: string,
    payload: Record<string, unknown>,
  ): Promise<IUser> {
    try {
      const response = await this._axiosInstance.put<{ user: IUser }>(
        `/user/${encodeURIComponent(user_id)}`,
        payload,
        {
          headers: {
            "x-tenant-id": tenant_id,
            "x-keycloak-id": keycloak_id,
            // OB-03: service-to-service bearer (role="service")
            "Authorization": serviceAuthClient.getAuthHeader(tenant_id),
          },
        },
      );
      return response.data.user;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          error.response.data?.message ?? error.response.data?.detail ?? "Update user failed",
        );
      }
      throw new Error("Network error — user service unreachable");
    }
  }
}

export const userService = new UserService();
