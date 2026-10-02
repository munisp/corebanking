import axios, { AxiosInstance } from "axios";
import http from "http";
import https from "https";
import {
  TInitiateTransferSchemaVfd,
  TLookupPartySchemaVfd,
  TVfdInflowSchema,
} from "../validations/v1";
import logger from "../config/logger.config";
import { readEnv } from "../config/readEnv.config";
import { IVfdLookupResponse } from "../types";

const url = readEnv("VFD_CONNECTOR_URL") as string;

// TS-41: keepAlive agents avoid TCP(+TLS) setup per VFD connector call.
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

export class VfdConnectorApiClient {
  private static __instance: VfdConnectorApiClient | null = null;
  private readonly clientAxios: AxiosInstance;

  private constructor() {
    this.clientAxios = axios.create({
      baseURL: url,
      timeout: 10000,
      httpAgent,
      httpsAgent,
    });
  }

  static instance(): VfdConnectorApiClient {
    if (!VfdConnectorApiClient.__instance) {
      VfdConnectorApiClient.__instance = new VfdConnectorApiClient();
    }
    return VfdConnectorApiClient.__instance;
  }

  public async lookup_party(input: TLookupPartySchemaVfd) {
    const { data } = await this.clientAxios.post<IVfdLookupResponse>(
      "/parties/lookup",
      input
    );
    return data;
  }

  public async initialize_transfer(
    body: TInitiateTransferSchemaVfd,
    tenant: string
  ) {
    // TS-40: full transfer bodies only at debug level (LOG_LEVEL=debug).
    logger.debug("initialize transfer", { body, tenant });
    const { data } = await this.clientAxios.post("/transfers/initiate", {
      ...body,
      tenant,
    });
    logger.debug("initialize transfer response", { data });
    return data;
  }

  public async create_notification(data: TVfdInflowSchema, tenant: string) {
    await this.clientAxios.post("/notifications", { ...data, tenant });
  }

  public async get_notifications(data: any, tenant: string) {
    return (
      await this.clientAxios.get("/notifications", {
        params: { ...data, tenant },
      })
    ).data;
  }
}
