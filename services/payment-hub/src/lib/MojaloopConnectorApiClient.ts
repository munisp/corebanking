import axios, { AxiosInstance } from "axios";
import http from "http";
import https from "https";
import logger from "../config/logger.config";
import { readEnv } from "../config/readEnv.config";
import { IRegisterParticipantInput } from "../types";
import { CurrencyEnum, PartyIdTypeEnum } from "../utils/enums";
import {
  TInitiateTransferSchemaMojaloop,
  TLookupPartySchemaMojaloop,
} from "../validations/v1";

const url = readEnv("MOJALOOP_CONNECTOR_URL") as string;

// Fail closed: payment-hub must never silently send transfers/lookups to an
// undefined baseURL (axios would fall back to relative URLs and produce
// confusing connection errors deep in the transfer path). Mirror the
// validation that services/mojaloop-connector performs for its switch URLs.
if (!url) {
  throw new Error(
    "MOJALOOP_CONNECTOR_URL environment variable is not configured. Please set it to the Mojaloop connector base URL (e.g., http://mojaloop-connector:9489)",
  );
}

// TS-42: keepAlive agents avoid TCP(+TLS) setup per transfer/lookup call.
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

export class MojaloopConnectorApiClient {
  private static instance: MojaloopConnectorApiClient | null = null;
  private readonly clientAxios: AxiosInstance;

  private constructor() {
    this.clientAxios = axios.create({
      baseURL: url,
      timeout: 10000,
      httpAgent,
      httpsAgent,
    });
  }

  static getInstance(): MojaloopConnectorApiClient {
    if (!MojaloopConnectorApiClient.instance) {
      MojaloopConnectorApiClient.instance = new MojaloopConnectorApiClient();
    }
    return MojaloopConnectorApiClient.instance;
  }

  public async initialize_transfer(
    body: TInitiateTransferSchemaMojaloop,
    headers?: Record<string, string>,
  ) {
    // TS-39: full transfer bodies/headers only at debug level (LOG_LEVEL=debug).
    logger.debug("initialize transfer", { body });
    logger.debug("with headers", { headers });
    const { data } = await this.clientAxios.post("/transfers/initiate", body, {
      headers,
    });
    logger.debug("initialize transfer response", { data });
    return data;
  }

  public async lookup_party(
    input: TLookupPartySchemaMojaloop,
    tenant_name: string,
  ) {
    const { data } = await this.clientAxios.post(
      "/parties/lookup",
      { ...input, tenant_name },
      {
        headers: { "fspiop-destination": input.destination },
      },
    );
    return data;
  }

  public async register_participant(input: IRegisterParticipantInput) {
    try {
      logger.debug("register_participant: init");

      const {
        currency = CurrencyEnum.NGN,
        identifier,
        identifier_type = PartyIdTypeEnum.MSISDN,
        tenant_name,
      } = input;

      const payload = {
        currency,
        identifier,
        identifier_type,
        tenant_name,
      };

      logger.debug("register_participant: payload", { payload });

      const { data } = await this.clientAxios.post(
        "/participants/register",
        payload,
      );

      logger.debug("Response From Oracle", { data });
    } catch (error) {
      logger.error("error registering participants", error);
    }
  }
}
