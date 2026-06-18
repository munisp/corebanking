import axios, { AxiosInstance } from "axios";
import * as https from "https";
import { readEnv } from "../config/readEnv.config";
import { IKycVerificationPayload, IKycVerificationResponse, IKybVerificationPayload, IKybVerificationResponse } from "../types/verification";

class VerificationService {
  private _axiosInstance: AxiosInstance;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: readEnv("VERIFICATION_SVC_URL"),
      headers: {
        "content-type": "application/json",
        "x-client-id": readEnv("VERIFICATION_SVC_CLIENT_ID"),
        "x-client-secret": readEnv("VERIFICATION_SVC_CLIENT_SECRET"),
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
  }

  public async initializeKycVerification(
    payload: IKycVerificationPayload
  ): Promise<IKycVerificationResponse> {
    try {
      const response = await this._axiosInstance.post("/kyc/initialize-verification", {
        ...payload,
        identityProvider: payload.identityProvider || readEnv("VERIFICATION_SVC_IDP"),
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        const d = error.response.data;
        const msg = d?.message ?? d?.detail?.message ?? (typeof d?.detail === "string" ? d.detail : null) ?? `Kyc initialization failed (HTTP ${error.response.status})`;
        console.error("[verificationService] KYC init failed:", { status: error.response.status, data: d });
        throw new Error(msg);
      }
      throw new Error(`Network error — verification service unreachable: ${error.message}`);
    }
  }

  public async initializeKybVerification(
    payload: IKybVerificationPayload
  ): Promise<IKybVerificationResponse> {
    try {
      const response = await this._axiosInstance.post("/kyb/initialize-verification", payload);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        const d = error.response.data;
        const msg = d?.message ?? d?.detail?.message ?? (typeof d?.detail === "string" ? d.detail : null) ?? `KYB initialization failed (HTTP ${error.response.status})`;
        console.error("[verificationService] KYB init failed:", { status: error.response.status, data: d });
        throw new Error(msg);
      }
      throw new Error(`Network error — verification service unreachable: ${error.message}`);
    }
  }
}

export const verificationService = new VerificationService();
