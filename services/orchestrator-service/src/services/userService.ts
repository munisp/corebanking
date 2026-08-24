import axios, { AxiosInstance } from "axios";
import { createSecureHttpsAgent } from "../lib/secureHttpsAgent";
import { readEnv } from "../config/readEnv.config";
import { IUser, IUserProfilePayload, IUserProfileResponse } from "../types/user";

class UserService {
  private _axiosInstance: AxiosInstance;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: readEnv("USER_SVC_URL"),
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
          },
        }
      );
    } catch (error: any) {
      // Fail gracefully.
    }
  }
}

export const userService = new UserService();
