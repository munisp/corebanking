import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";
import logger from "../config/logger.config";

const userServiceUrl = readEnv("USER_SERVICE_URL") as string;

export interface UserProfile {
  kycStatus: string;
  fullName: string;
  tier: number;
}

class UserServiceApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: userServiceUrl });
  }

  async getUserProfile(tenantId: string, keycloakId: string): Promise<UserProfile> {
    logger.info(`Fetching user profile for tenantId=${tenantId} and keycloakId=${keycloakId} , link: ${userServiceUrl}/user`);
    const res = await this.http.get("/user", {
      headers: {
        "x-tenant-id": tenantId,
        "x-keycloak-id": keycloakId,
      },
    });
    const data = res.data?.user ?? res.data ?? {};
    const fullName =
      data.name ||
      [data.first_name, data.last_name].filter(Boolean).join(" ") ||
      keycloakId;
    return {
      kycStatus: data.kyc_verification_status as string,
      fullName,
      tier: typeof data.tier === "number" ? data.tier : 1,
    };
  }
}

export const userServiceApiClient = new UserServiceApiClient();
