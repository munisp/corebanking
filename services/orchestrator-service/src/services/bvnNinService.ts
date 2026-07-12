import axios, { AxiosInstance } from "axios";
import * as https from "https";
import { readEnv } from "../config/readEnv.config";

interface BVNVerification {
  verified: boolean;
  bvn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ninLinked: boolean;
  linkedNIN: string;
}

interface NINVerification {
  verified: boolean;
  nin: string;
  firstName: string;
  lastName: string;
  residentialAddress: string;
  bvnLinked: boolean;
  linkedBVN: string;
}

interface BVNNINLinkage {
  linkageStatus: string;
  nameMatch: boolean;
  dobMatch: boolean;
  discrepancies: string[];
}

class BvnNinService {
  private _axiosInstance: AxiosInstance;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: readEnv("BVN_NIN_SVC_URL"),
      headers: { "content-type": "application/json" },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 20000,
    });
  }

  async verifyNIN(nin: string, tenant_id: string, customer_id: string): Promise<NINVerification> {
    const response = await this._axiosInstance.post<NINVerification>(
      "/api/nin/verify",
      { nin, customerId: customer_id },
      { headers: { "x-tenant-id": tenant_id } },
    );
    return response.data;
  }

  async verifyBVN(bvn: string, tenant_id: string, customer_id: string): Promise<BVNVerification> {
    const response = await this._axiosInstance.post<BVNVerification>(
      "/api/bvn/verify",
      { bvn, customerId: customer_id },
      { headers: { "x-tenant-id": tenant_id } },
    );
    return response.data;
  }

  async checkLinkage(
    bvn: string,
    nin: string,
    tenant_id: string,
    customer_id: string,
  ): Promise<BVNNINLinkage> {
    const response = await this._axiosInstance.post<BVNNINLinkage>(
      "/api/bvn-nin/check",
      { bvn, nin, customerId: customer_id },
      { headers: { "x-tenant-id": tenant_id } },
    );
    return response.data;
  }
}

export const bvnNinService = new BvnNinService();
