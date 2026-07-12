import axios from "axios";
import { getTenantHeaders } from "../services/tenant/getTenantHeaders";
import { BACKEND_URL } from "../const";
import type {
  ApproveTransactionRequest,
  CashDepositRequest,
  CashWithdrawalRequest,
  CheckCashingRequest,
  CheckDepositRequest,
  CloseTillRequest,
  CloseVaultRequest,
  CompleteVaultCountRequest,
  CreateTillRequest,
  CreateTillTransferRequest,
  CreateVaultRequest,
  CTRReport,
  DenominationBreakdown,
  EODReport,
  IssueTicketRequest,
  ListQueueTicketsParams,
  ListTellersParams,
  ListTillsParams,
  ListTransactionsParams,
  ListTransfersParams,
  ListVaultsParams,
  OpenTillRequest,
  OpenVaultRequest,
  PaginatedResponse,
  QueueStats,
  QueueTicket,
  RegisterTellerRequest,
  RejectTransactionRequest,
  ReverseTransactionRequest,
  StartVaultCountRequest,
  StructuredDenominationBreakdown,
  Teller,
  TellerStats,
  Till,
  TillBalance,
  TillTransfer,
  Transaction,
  TransferTicketRequest,
  UpdateTellerAssignmentRequest,
  UpdateTellerStatusRequest,
  Vault,
  VaultBalance,
  WindowStatus,
} from "../types/teller";

const API_BASE_URL =
  import.meta.env.VITE_TELLER_SERVICE_URL ||
  `${BACKEND_URL}/teller/api/v1`;

const tellerApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const safeParseJson = <T>(value: string | null): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const decodeJwtPayload = (
  token: string | null,
): Record<string, unknown> | undefined => {
  if (!token) return undefined;
  const parts = token.split(".");
  if (parts.length < 2) return undefined;
  const base64 = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
  try {
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const getEffectiveKeycloakId = (): string | undefined => {
  // Prefer explicit storage set during auth flows.
  const keycloakIdFromStorage =
    localStorage.getItem("keycloak_id") ?? undefined;
  if (keycloakIdFromStorage) return keycloakIdFromStorage;

  const authUser = safeParseJson<{ id?: string; keycloak_id?: string }>(
    localStorage.getItem("auth_user"),
  );
  if (typeof authUser?.keycloak_id === "string" && authUser.keycloak_id) {
    return authUser.keycloak_id;
  }

  // Fall back to decoding the JWT (Keycloak typically uses `sub` as user id).
  const token =
    localStorage.getItem("auth_token") || localStorage.getItem("54link-dev_token");
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  if (typeof sub === "string" && sub) return sub;

  return undefined;
};

// Add auth token to requests
tellerApi.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("auth_token") || localStorage.getItem("54link-dev_token");

  config.headers = config.headers ?? {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Apply tenant headers if available (x-tenant-id, x-ledger-id, etc.)
  // and ensure x-keycloak-id reflects the CURRENT user identity.
  try {
    const tenantConfigStr = localStorage.getItem("tenant_config");
    if (tenantConfigStr) {
      const parsed = JSON.parse(tenantConfigStr);
      const tenantConfig = parsed?.tenant || parsed;
      const tenantHeaders = getTenantHeaders(tenantConfig);
      Object.assign(config.headers, tenantHeaders);
    }
  } catch {
    // best-effort only
  }

  const authUser = safeParseJson<{ id?: string; keycloak_id?: string }>(
    localStorage.getItem("auth_user"),
  );

  const keycloakId = getEffectiveKeycloakId();

  if (keycloakId) {
    // Keep this aligned to the CURRENT user identity.
    config.headers["x-keycloak-id"] = keycloakId;
    // Some proxies / middleware stacks are picky about casing for non-standard headers.
    config.headers["X-Keycloak-ID"] = keycloakId;
    config.headers["x-user-id"] = keycloakId;
    config.headers["x-user-role"] = authUser?.id === keycloakId ? "super_admin" : "super_admin"; // Assuming only admins can perform API actions; adjust as needed
  }

  // teller-service requires branch context for most state-changing operations.
  // We keep it in localStorage (written by TellerOperations after resolving the teller's till).
  const branchIdFromStorage =
    localStorage.getItem("branch_id") ||
    localStorage.getItem("selected_branch_id") ||
    localStorage.getItem("x-branch-id") ||
    localStorage.getItem("X-Branch-ID") ||
    "";
  if (branchIdFromStorage) {
    config.headers["x-branch-id"] = branchIdFromStorage;
    config.headers["X-Branch-ID"] = branchIdFromStorage;
  }

  // teller-service (Go) uses x-keycloak-id as the source of requested_by / approved_by.
  // If this header is missing, both values can be empty and the service will treat
  // every approval as “approving your own request”.
  // Prefer internal user id when available; some deployments store this in tellers.employee_id.
  const effectiveUserId =
    typeof authUser?.id === "string" && authUser.id ? authUser.id : keycloakId;
  if (effectiveUserId) {
    config.headers["x-keycloak-id"] = effectiveUserId;
    config.headers["x-user-id"] = effectiveUserId;
    config.headers["x-user-role"] = authUser?.id === effectiveUserId ? "super_admin" : "super_admin"; // Assuming only admins can perform API actions; adjust as needed
  }

  return config;
});

// Helper function to transform API responses to PaginatedResponse format
const transformPaginatedResponse = <T>(
  data: Record<string, unknown>,
  dataField: string,
): PaginatedResponse<T> => {
  const raw = data as Record<string, unknown>;
  const fieldValue = raw[dataField];
  const rows = Array.isArray(fieldValue) ? (fieldValue as T[]) : ([] as T[]);
  const total = typeof raw.total === "number" ? raw.total : 0;
  const page = typeof raw.page === "number" ? raw.page : 1;
  const limit = typeof raw.limit === "number" ? raw.limit : 10;
  const totalPagesFromApi =
    typeof raw.total_pages === "number" ? raw.total_pages : undefined;

  return {
    data: rows,
    total,
    page,
    limit,
    total_pages: totalPagesFromApi ?? Math.ceil(total / limit),
  };
};

const normalizeTeller = (raw: unknown): Teller => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = (r.id ?? r.teller_id ?? "") as string;
  const employeeNumber = (r.employee_number ?? "") as string;

  return {
    id,
    // Backend uses employee_id/employee_number; UI historically used user_id.
    user_id: (r.user_id ?? r.employee_id ?? employeeNumber) as string,
    employee_number: employeeNumber,
    first_name: (r.first_name ?? "") as string,
    last_name: (r.last_name ?? "") as string,
    email: (r.email ?? "") as string,
    phone: (r.phone ?? "") as string,
    status: (r.status ?? "inactive") as Teller["status"],
    window_number:
      r.window_number === undefined || r.window_number === null
        ? undefined
        : String(r.window_number),
    assigned_till_id: (r.assigned_till_id ?? r.till_id) as string | undefined,
    daily_transaction_limit: (r.daily_transaction_limit ??
      r.daily_txn_limit ??
      0) as number,
    single_transaction_limit: (r.single_transaction_limit ??
      r.single_txn_limit ??
      0) as number,
    created_at: (r.created_at ?? new Date().toISOString()) as string,
    updated_at: (r.updated_at ?? new Date().toISOString()) as string,
    last_login_at: r.last_login_at as string | undefined,
  } as Teller;
};

const normalizeTransaction = (raw: unknown): Transaction => {
  const r = (raw ?? {}) as Record<string, unknown>;

  const id = String((r.id ?? r.transaction_id ?? "") as string);
  const transactionType = String(
    (r.transaction_type ?? r.type ?? "") as string,
  ) as Transaction["transaction_type"];

  return {
    id,
    transaction_type: transactionType,
    teller_id: String((r.teller_id ?? "") as string),
    till_id:
      r.till_id === undefined || r.till_id === null
        ? undefined
        : String(r.till_id),
    customer_id: String((r.customer_id ?? "") as string),
    account_number: String((r.account_number ?? "") as string),
    amount: Number(r.amount ?? 0),
    currency: String((r.currency ?? "NGN") as string),
    denomination_breakdown:
      (r.denomination_breakdown as Transaction["denomination_breakdown"]) ??
      undefined,
    status: String((r.status ?? "pending") as string) as Transaction["status"],
    requires_approval: Boolean(r.requires_approval ?? false),
    approval_status:
      r.approval_status === undefined || r.approval_status === null
        ? undefined
        : (String(r.approval_status) as Transaction["approval_status"]),
    approved_by:
      r.approved_by === undefined || r.approved_by === null
        ? undefined
        : String(r.approved_by),
    approved_at:
      r.approved_at === undefined || r.approved_at === null
        ? undefined
        : String(r.approved_at),
    rejection_reason:
      r.rejection_reason === undefined || r.rejection_reason === null
        ? undefined
        : String(r.rejection_reason),
    reversed: Boolean(r.reversed ?? false),
    reversed_by:
      r.reversed_by === undefined || r.reversed_by === null
        ? undefined
        : String(r.reversed_by),
    reversed_at:
      r.reversed_at === undefined || r.reversed_at === null
        ? undefined
        : String(r.reversed_at),
    reversal_reason:
      r.reversal_reason === undefined || r.reversal_reason === null
        ? undefined
        : String(r.reversal_reason),
    reference_number: String(
      (r.reference_number ?? r.reference ?? "") as string,
    ),
    check_number:
      r.check_number === undefined || r.check_number === null
        ? undefined
        : String(r.check_number),
    check_details:
      (r.check_details as Transaction["check_details"]) ?? undefined,
    transaction_notes:
      r.transaction_notes === undefined || r.transaction_notes === null
        ? undefined
        : String(r.transaction_notes),
    customer_verification_method:
      r.customer_verification_method === undefined ||
      r.customer_verification_method === null
        ? undefined
        : String(r.customer_verification_method),
    created_at: String((r.created_at ?? "") as string),
    updated_at: String((r.updated_at ?? r.created_at ?? "") as string),
  };
};

const normalizeTransfer = (raw: unknown): TillTransfer => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = (r.id ?? r.transfer_id ?? "") as string;

  const asTransferPartyType = (
    value: unknown,
  ): TillTransfer["dest_type"] | undefined => {
    if (value === "till" || value === "vault" || value === "") return value;
    return undefined;
  };

  const sourceType = (r.source_type ?? "") as TillTransfer["source_type"];
  const destinationType = (r.destination_type ?? r.dest_type ?? undefined) as
    | TillTransfer["destination_type"]
    | undefined;

  const computedTransferType = (() => {
    if (sourceType === "till" && destinationType === "vault") {
      return "till_to_vault" as const;
    }
    if (sourceType === "vault" && destinationType === "till") {
      return "vault_to_till" as const;
    }
    if (sourceType === "till" && destinationType === "till") {
      return "till_to_till" as const;
    }
    return undefined;
  })();

  const amountRaw = r.amount;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? Number(amountRaw)
        : 0;

  return {
    id,
    transfer_type:
      (r.transfer_type as TillTransfer["transfer_type"]) ??
      computedTransferType,
    source_type: sourceType || "till",
    source_id: (r.source_id ?? "") as string,
    destination_type: destinationType,
    destination_id: (r.destination_id ?? r.dest_id ?? undefined) as
      | string
      | undefined,
    dest_type: asTransferPartyType(r.dest_type),
    dest_id: typeof r.dest_id === "string" ? r.dest_id : undefined,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: (r.currency as string | undefined) ?? undefined,
    denomination_breakdown:
      (r.denomination_breakdown as
        | DenominationBreakdown
        | StructuredDenominationBreakdown
        | undefined) ?? undefined,
    status: (r.status ?? "pending") as TillTransfer["status"],
    initiated_by: (r.initiated_by as string | undefined) ?? undefined,
    requested_by: (r.requested_by as string | undefined) ?? undefined,
    approved_by: (r.approved_by as string | undefined) ?? undefined,
    rejected_by: (r.rejected_by as string | undefined) ?? undefined,
    rejection_reason: (r.rejection_reason as string | undefined) ?? undefined,
    notes: (r.notes as string | undefined) ?? undefined,
    created_at: (r.created_at ?? new Date().toISOString()) as string,
    updated_at: (r.updated_at as string | undefined) ?? undefined,
  };
};

// ============================================
// TELLER MANAGEMENT
// ============================================

export const tellerService = {
  // List all tellers
  listTellers: async (
    params?: ListTellersParams,
  ): Promise<PaginatedResponse<Teller>> => {
    const response = await tellerApi.get("/tellers", { params });
    const paged = transformPaginatedResponse<unknown>(
      response.data as Record<string, unknown>,
      "tellers",
    );
    return {
      ...paged,
      data: paged.data.map(normalizeTeller),
    };
  },

  // Register new teller
  registerTeller: async (data: RegisterTellerRequest): Promise<Teller> => {
    const response = await tellerApi.post("/tellers", data);
    return normalizeTeller(response.data);
  },

  // Get teller details
  getTeller: async (tellerId: string): Promise<Teller> => {
    const response = await tellerApi.get(`/tellers/${tellerId}`);
    return normalizeTeller(response.data);
  },

  // Update teller status
  updateTellerStatus: async (
    tellerId: string,
    data: UpdateTellerStatusRequest,
  ): Promise<Teller> => {
    const response = await tellerApi.patch(`/tellers/${tellerId}/status`, data);
    return normalizeTeller(response.data);
  },

  // Update teller assignment (window/till)
  updateTellerAssignment: async (
    tellerId: string,
    data: UpdateTellerAssignmentRequest,
  ): Promise<Teller> => {
    const response = await tellerApi.patch(
      `/tellers/${tellerId}/assignment`,
      data,
    );
    return normalizeTeller(response.data);
  },

  // Get teller statistics
  getTellerStats: async (tellerId: string): Promise<TellerStats> => {
    const response = await tellerApi.get(`/tellers/${tellerId}/stats`);
    return response.data;
  },
};

// ============================================
// TILL MANAGEMENT
// ============================================

export const tillService = {
  // List all tills
  listTills: async (
    params?: ListTillsParams,
  ): Promise<PaginatedResponse<Till>> => {
    const response = await tellerApi.get("/tills", { params });
    return transformPaginatedResponse<Till>(response.data, "tills");
  },

  // Create new till
  createTill: async (data: CreateTillRequest): Promise<Till> => {
    // Only send window_number as required by backend
    const response = await tellerApi.post("/tills", {
      window_number: data.window_number,
    });
    return response.data;
  },

  // Get till details
  getTill: async (tillId: string): Promise<Till> => {
    const response = await tellerApi.get(`/tills/${tillId}`);
    return response.data;
  },

  // Open till
  openTill: async (tillId: string, data: OpenTillRequest): Promise<Till> => {
    const response = await tellerApi.post(`/tills/${tillId}/open`, data);
    return response.data;
  },

  // Close till
  closeTill: async (tillId: string, data: CloseTillRequest): Promise<Till> => {
    const response = await tellerApi.post(`/tills/${tillId}/close`, data);
    return response.data;
  },

  // Get till balance
  getTillBalance: async (tillId: string): Promise<TillBalance> => {
    const response = await tellerApi.get(`/tills/${tillId}/balance`);
    return response.data;
  },

  // Start till balancing
  startBalancing: async (tillId: string): Promise<Till> => {
    const response = await tellerApi.post(`/tills/${tillId}/balancing`);
    return response.data;
  },
};

// ============================================
// VAULT MANAGEMENT
// ============================================

export const vaultService = {
  // List all vaults
  listVaults: async (
    params?: ListVaultsParams,
  ): Promise<PaginatedResponse<Vault>> => {
    const response = await tellerApi.get("/vaults", { params });
    return transformPaginatedResponse<Vault>(response.data, "vaults");
  },

  // Create new vault
  createVault: async (data: CreateVaultRequest): Promise<Vault> => {
    const response = await tellerApi.post("/vaults", data);
    return response.data;
  },

  // Get vault details
  getVault: async (vaultId: string): Promise<Vault> => {
    const response = await tellerApi.get(`/vaults/${vaultId}`);
    return response.data;
  },

  // Open vault
  openVault: async (
    vaultId: string,
    data: OpenVaultRequest,
  ): Promise<{ status: string }> => {
    // Backend expects: primary_authorizer_id / secondary_authorizer_id
    // UI uses: custodian_1_id / custodian_2_id
    // Send both for compatibility with mixed deployments.
    const payload = {
      primary_authorizer_id:
        (data as unknown as { primary_authorizer_id?: string })
          .primary_authorizer_id || data.custodian_1_id,
      secondary_authorizer_id:
        (data as unknown as { secondary_authorizer_id?: string })
          .secondary_authorizer_id || data.custodian_2_id,
      custodian_1_id: data.custodian_1_id,
      custodian_2_id: data.custodian_2_id,
    };

    const response = await tellerApi.post(`/vaults/${vaultId}/open`, payload);
    return response.data;
  },

  // Close vault
  closeVault: async (
    vaultId: string,
    data: CloseVaultRequest,
  ): Promise<Vault> => {
    const response = await tellerApi.post(`/vaults/${vaultId}/close`, data);
    return response.data;
  },

  // Get vault balance
  getVaultBalance: async (vaultId: string): Promise<VaultBalance> => {
    const response = await tellerApi.get(`/vaults/${vaultId}/balance`);
    return response.data;
  },

  // Start vault count
  startVaultCount: async (
    vaultId: string,
    data: StartVaultCountRequest,
  ): Promise<Vault> => {
    const response = await tellerApi.post(
      `/vaults/${vaultId}/count/start`,
      data,
    );
    return response.data;
  },

  // Complete vault count
  completeVaultCount: async (
    vaultId: string,
    data: CompleteVaultCountRequest,
  ): Promise<Vault> => {
    const response = await tellerApi.post(
      `/vaults/${vaultId}/count/complete`,
      data,
    );
    return response.data;
  },
};

// ============================================
// TILL/VAULT TRANSFERS
// ============================================

export const transferService = {
  // List all transfers
  listTillTransfers: async (
    params?: ListTransfersParams,
  ): Promise<PaginatedResponse<TillTransfer>> => {
    const response = await tellerApi.get("/transfers", { params });
    const paged = transformPaginatedResponse<unknown>(
      response.data as Record<string, unknown>,
      "transfers",
    );
    return {
      ...paged,
      data: paged.data.map(normalizeTransfer),
    };
  },

  // Create new transfer
  createTillTransfer: async (
    data: CreateTillTransferRequest,
  ): Promise<TillTransfer> => {
    const breakdownCurrency = (() => {
      const b = data.denomination_breakdown as
        | StructuredDenominationBreakdown
        | DenominationBreakdown
        | undefined;
      if (!b) return undefined;
      return (b as StructuredDenominationBreakdown).currency;
    })();

    const payload = {
      transfer_type: data.transfer_type,
      source_type: data.source_type,
      source_id: data.source_id,
      // Backend expects dest_type/dest_id
      dest_type: data.dest_type ?? data.destination_type,
      dest_id: data.dest_id ?? data.destination_id,
      // Keep legacy fields too (harmless if ignored)
      destination_type: data.destination_type,
      destination_id: data.destination_id,
      amount: data.amount,
      currency: data.currency ?? breakdownCurrency ?? "NGN",
      denomination_breakdown: data.denomination_breakdown,
      notes: data.notes,
    };

    const response = await tellerApi.post("/transfers", payload);
    return normalizeTransfer(response.data);
  },

  // Get transfer details
  getTillTransfer: async (transferId: string): Promise<TillTransfer> => {
    const response = await tellerApi.get(`/transfers/${transferId}`);
    return normalizeTransfer(response.data);
  },

  // Approve transfer
  approveTillTransfer: async (transferId: string): Promise<TillTransfer> => {
    const response = await tellerApi.post(`/transfers/${transferId}/approve`);
    return normalizeTransfer(response.data);
  },

  // Reject transfer
  rejectTillTransfer: async (
    transferId: string,
    reason: string,
  ): Promise<TillTransfer> => {
    const response = await tellerApi.post(`/transfers/${transferId}/reject`, {
      rejection_reason: reason,
    });
    return normalizeTransfer(response.data);
  },
};

// ============================================
// TELLER TRANSACTIONS
// ============================================

export const transactionService = {
  // List all transactions
  listTransactions: async (
    params?: ListTransactionsParams,
  ): Promise<PaginatedResponse<Transaction>> => {
    // Backend expects `type`, UI uses `transaction_type`.
    const apiParams: Record<string, unknown> = { ...(params ?? {}) };
    if (typeof apiParams.transaction_type === "string" && apiParams.transaction_type) {
      apiParams.type = apiParams.transaction_type;
      delete apiParams.transaction_type;
    }

    const response = await tellerApi.get("/transactions", { params: apiParams });
    const paged = transformPaginatedResponse<unknown>(
      response.data,
      "transactions",
    );
    return {
      ...paged,
      data: paged.data.map((t) => normalizeTransaction(t)),
    };
  },

  // Get transaction details
  getTransaction: async (transactionId: string): Promise<Transaction> => {
    const response = await tellerApi.get(`/transactions/${transactionId}`);
    return normalizeTransaction(response.data);
  },

  // Cash deposit
  cashDeposit: async (data: CashDepositRequest): Promise<Transaction> => {
    const response = await tellerApi.post("/transactions/cash/deposit", data);
    return normalizeTransaction(response.data);
  },

  // Cash withdrawal
  cashWithdrawal: async (data: CashWithdrawalRequest): Promise<Transaction> => {
    const response = await tellerApi.post(
      "/transactions/cash/withdrawal",
      data,
    );
    return normalizeTransaction(response.data);
  },

  // Check deposit
  checkDeposit: async (data: CheckDepositRequest): Promise<Transaction> => {
    const response = await tellerApi.post("/transactions/check/deposit", data);
    return normalizeTransaction(response.data);
  },

  // Check cashing
  checkCashing: async (data: CheckCashingRequest): Promise<Transaction> => {
    const response = await tellerApi.post("/transactions/check/cashing", data);
    return normalizeTransaction(response.data);
  },

  // Approve transaction
  approveTransaction: async (
    transactionId: string,
    data?: ApproveTransactionRequest,
  ): Promise<Transaction> => {
    const response = await tellerApi.post(
      `/transactions/${transactionId}/approve`,
      data,
    );
    return normalizeTransaction(response.data);
  },

  // Reject transaction
  rejectTransaction: async (
    transactionId: string,
    data: RejectTransactionRequest,
  ): Promise<Transaction> => {
    const response = await tellerApi.post(
      `/transactions/${transactionId}/reject`,
      data,
    );
    return normalizeTransaction(response.data);
  },

  // Reverse transaction
  reverseTransaction: async (
    transactionId: string,
    data: ReverseTransactionRequest,
  ): Promise<Transaction> => {
    const response = await tellerApi.post(
      `/transactions/${transactionId}/reverse`,
      data,
    );
    return normalizeTransaction(response.data);
  },

  // Get pending approvals
  getPendingApprovals: async (): Promise<Transaction[]> => {
    const response = await tellerApi.get("/transactions/pending-approvals");
    // Handle both array and object responses
    if (Array.isArray(response.data)) {
      return (response.data as unknown[]).map((t) => normalizeTransaction(t));
    }

    const rawRows =
      (response.data?.transactions as unknown[]) ||
      (response.data?.data as unknown[]) ||
      [];
    return rawRows.map((t) => normalizeTransaction(t));
  },
};

// ============================================
// CTR REPORTS
// ============================================

export const ctrService = {
  // List all CTR reports
  listCTRReports: async (): Promise<CTRReport[]> => {
    const response = await tellerApi.get("/ctr-reports");
    // Handle both array and object responses
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (
      response.data.ctr_reports ||
      response.data.reports ||
      response.data.data ||
      []
    );
  },

  // Get CTR report details
  getCTRReport: async (ctrId: string): Promise<CTRReport> => {
    const response = await tellerApi.get(`/ctr-reports/${ctrId}`);
    return response.data;
  },

  // File CTR report
  fileCTRReport: async (ctrId: string): Promise<CTRReport> => {
    const response = await tellerApi.post(`/ctr-reports/${ctrId}/file`);
    return response.data;
  },
};

// ============================================
// END-OF-DAY REPORTS
// ============================================

export const eodService = {
  // List all EOD reports
  listEODReports: async (): Promise<EODReport[]> => {
    const response = await tellerApi.get("/eod-reports");
    // Handle both array and object responses
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (
      response.data.eod_reports ||
      response.data.reports ||
      response.data.data ||
      []
    );
  },

  // Get EOD report details
  getEODReport: async (reportId: string): Promise<EODReport> => {
    const response = await tellerApi.get(`/eod-reports/${reportId}`);
    return response.data;
  },

  // Verify EOD report
  verifyEODReport: async (reportId: string): Promise<EODReport> => {
    const response = await tellerApi.post(`/eod-reports/${reportId}/verify`);
    return response.data;
  },

  // Approve EOD report
  approveEODReport: async (reportId: string): Promise<EODReport> => {
    const response = await tellerApi.post(`/eod-reports/${reportId}/approve`);
    return response.data;
  },
};

// ============================================
// QUEUE MANAGEMENT
// ============================================

export const queueService = {
  // List queue tickets
  listQueueTickets: async (
    params?: ListQueueTicketsParams,
  ): Promise<PaginatedResponse<QueueTicket>> => {
    const response = await tellerApi.get("/queue/tickets", { params });
    return transformPaginatedResponse<QueueTicket>(response.data, "tickets");
  },

  // Issue new ticket
  issueTicket: async (data: IssueTicketRequest): Promise<QueueTicket> => {
    const response = await tellerApi.post("/queue/tickets", data);
    return response.data;
  },

  // Get ticket details
  getTicket: async (ticketId: string): Promise<QueueTicket> => {
    const response = await tellerApi.get(`/queue/tickets/${ticketId}`);
    return response.data;
  },

  // Cancel ticket
  cancelTicket: async (ticketId: string): Promise<QueueTicket> => {
    const response = await tellerApi.post(`/queue/tickets/${ticketId}/cancel`);
    return response.data;
  },

  // Call next customer
  callNextCustomer: async (windowNumber: string): Promise<QueueTicket> => {
    const response = await tellerApi.post("/queue/call-next", {
      window_number: windowNumber,
    });
    return response.data;
  },

  // Start serving ticket
  startServing: async (ticketId: string): Promise<QueueTicket> => {
    const response = await tellerApi.post(
      `/queue/tickets/${ticketId}/start-serving`,
    );
    return response.data;
  },

  // Complete service
  completeService: async (
    ticketId: string,
    notes?: string,
  ): Promise<QueueTicket> => {
    const response = await tellerApi.post(
      `/queue/tickets/${ticketId}/complete`,
      { notes },
    );
    return response.data;
  },

  // Mark as no-show
  markNoShow: async (ticketId: string): Promise<QueueTicket> => {
    const response = await tellerApi.post(`/queue/tickets/${ticketId}/no-show`);
    return response.data;
  },

  // Recall ticket
  recallTicket: async (ticketId: string): Promise<QueueTicket> => {
    const response = await tellerApi.post(`/queue/tickets/${ticketId}/recall`);
    return response.data;
  },

  // Transfer ticket
  transferTicket: async (
    ticketId: string,
    data: TransferTicketRequest,
  ): Promise<QueueTicket> => {
    const response = await tellerApi.post(
      `/queue/tickets/${ticketId}/transfer`,
      data,
    );
    return response.data;
  },

  // Get queue stats
  getQueueStats: async (): Promise<QueueStats> => {
    const response = await tellerApi.get("/queue/stats");
    return response.data;
  },

  // Get window status
  getWindowStatus: async (): Promise<WindowStatus[]> => {
    const response = await tellerApi.get("/queue/windows");
    // Handle both array and object responses
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data.windows || response.data.data || [];
  },
};

export default {
  teller: tellerService,
  till: tillService,
  vault: vaultService,
  transfer: transferService,
  transaction: transactionService,
  ctr: ctrService,
  eod: eodService,
  queue: queueService,
};
