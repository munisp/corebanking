import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";

interface BillingStatus {
  status: string;
}

class BillingApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: readEnv<string>("BILLING_SVC_URL", "http://billing-service"),
      timeout: 5_000,
    });
  }

  async getTenantBillingStatus(tenantId: string): Promise<string> {
    try {
      const res = await this.http.get<BillingStatus>("/billing/status", {
        headers: { "x-tenant-id": tenantId },
      });
      return res.data?.status ?? "active";
    } catch {
      return "active";
    }
  }
}

export const billingApiClient = new BillingApiClient();
