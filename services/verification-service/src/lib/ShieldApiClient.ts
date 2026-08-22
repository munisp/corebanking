import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";
import logger from "../config/logger.config";
import * as https from "https";
import { InitVerification, IVerifyFace, IVerifyFaceResult } from "../types/verification";
import { ShieldConfig } from "../types/config";

// H-50: TLS certificate verification is ON by default for this API-key-bearing
// client. The only opt-out is an explicit development override:
// ALLOW_INSECURE_TLS=true AND non-production. In production the override is
// ignored (fail closed) and a loud warning is logged.
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.ENVIRONMENT === "production";
const ALLOW_INSECURE_TLS = process.env.ALLOW_INSECURE_TLS === "true" && !IS_PRODUCTION;
if (process.env.ALLOW_INSECURE_TLS === "true") {
  logger.warn(
    ALLOW_INSECURE_TLS
      ? "[TLS] ALLOW_INSECURE_TLS=true — ShieldApiClient TLS certificate verification DISABLED (non-production override). NEVER use in production."
      : "[TLS] ALLOW_INSECURE_TLS=true IGNORED in production — ShieldApiClient TLS certificate verification remains ENABLED."
  );
}

class ShieldApiClient {
  private _axiosInstance: AxiosInstance;
  private _baseUrl = readEnv("SHIELD_VERIFICATION_BASE_URL");
  private _apiKey = readEnv("SHIELD_VERIFICATION_API_KEY");
  private _logger = logger;

  constructor() {
    this._axiosInstance = axios.create({
      baseURL: this._baseUrl,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this._apiKey,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: !ALLOW_INSECURE_TLS,
      }),
    });
  }

  async setupInternalClient(): Promise<ShieldConfig> {
    this._logger.info("Setting up shield internal client..");
    const response = await this._axiosInstance.post<ShieldConfig>(
      "/verification/register-verification-client",
      {
        clientName: "Newwave Verification Portal",
        redirectUrl: "",
        callbackUrl: `${readEnv("SHIELD_API_URL")}/notifications/shield`,
      }
    );
    // M-52: never dump raw provider responses (may contain BVN/NIN PII) to logs.
    this._logger.info(`setup_shield_internal_client_response: status=${response.status}`);
    return response.data;
  }

  async initVerification(payload: InitVerification) {
    const response = await this._axiosInstance.post(
      "/verification/verify-client-verification-session",
      payload
    );
    this._logger.info(`init_shield_verification_response: status=${response.status}`);
  }

  async verifyFace(payload: IVerifyFace): Promise<IVerifyFaceResult> {
    const response = await this._axiosInstance.post<IVerifyFaceResult>(
      "/verification/face-verification",
      payload
    );
    this._logger.info(`shield_face_verification_response: status=${response.status}`);
    return response.data;
  }
}

export const shieldApiClient = new ShieldApiClient();
