import axios, { AxiosInstance } from "axios";
import { createSecureHttpsAgent } from "../lib/secureHttpsAgent";
import { readEnv } from "../config/readEnv.config";

interface IBillingInfo {
  status: string;
}

class BillingService {
  private _axiosInstance: AxiosInstance;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: readEnv("BILLING_SVC_URL"),
      headers: {
        "content-type": "application/json",
      },
      httpsAgent: createSecureHttpsAgent(),
    });
  }

  public async getBillingInfo(tenant_id: string): Promise<IBillingInfo> {
    try {
      const response = await this._axiosInstance.get<IBillingInfo>(`/billing/status`, {
        headers: {
          "x-tenant-id": tenant_id,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data?.message ?? "Billing info fetch failed");
      }
      throw new Error("Network error — billing service unreachable");
    }
  }
}

export const billingService = new BillingService();
