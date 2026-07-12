import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";

const txnLedgerUrl = readEnv("TRANSACTION_LEDGER_URL") as string;

class TransactionLedgerApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: txnLedgerUrl, timeout: 10_000 });
  }

  async getDailyDebitTotal(accountId: string, tenantId: string): Promise<number> {
    const res = await this.http.get(`/txn/account/${encodeURIComponent(accountId)}/daily-total`, {
      headers: { "x-tenant-id": tenantId },
    });
    return (res.data?.total_naira as number) ?? 0;
  }
}

export const transactionLedgerApiClient = new TransactionLedgerApiClient();
