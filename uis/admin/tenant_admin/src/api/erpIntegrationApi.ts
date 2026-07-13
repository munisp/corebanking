import apiClient from "../services/api";

// Types - ERP Integration API
export type ERPProvider =
  | "quickbooks"
  | "xero"
  | "sage"
  | "netsuite"
  | "dynamics365"
  | "sap"
  | "erpnext";
export type ConnectionStatus = "active" | "inactive" | "error" | "pending";
export type SyncStatus = "pending" | "in_progress" | "completed" | "failed";
export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface ERPConnection {
  id: string;
  tenant_id: string;
  customer_id: string;
  name: string; // Backend uses 'name' not 'connection_name'
  erp_type: string; // Backend uses 'erp_type' not 'provider'
  base_url: string;
  oauth_expiry: string;
  status: ConnectionStatus;
  last_sync_at: string;
  sync_frequency: string;
  created_at: string;
  updated_at: string;
  
  // Optional fields for backward compatibility
  provider?: ERPProvider;
  connection_name?: string;
  credentials?: Record<string, string | number | boolean>;
  sync_settings?: {
    auto_sync_enabled: boolean;
    sync_frequency: "realtime" | "hourly" | "daily" | "weekly";
    last_sync_at?: string;
    next_sync_at?: string;
  };
  last_tested_at?: string;
  error_message?: string;
}

export interface BankAccount {
  id: string;
  tenant_id: string;
  customer_id: string;
  erp_connection_id?: string;
  account_number: string;
  account_name: string;
  account_type: "checking" | "savings" | "credit" | "loan" | "investment";
  currency: string;
  balance: number;
  available_balance: number;
  institution_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_synced_at?: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  customer_id: string;
  erp_connection_id?: string;
  from_account_id: string;
  to_account_id?: string;
  amount: number;
  currency: string;
  payment_type: "transfer" | "payment" | "withdrawal" | "deposit";
  status: PaymentStatus;
  reference_number?: string;
  description?: string;
  scheduled_date?: string;
  processed_date?: string;
  created_at: string;
  updated_at: string;
  erp_sync_status?: SyncStatus;
  erp_reference_id?: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  customer_id: string;
  erp_connection_id: string;
  invoice_number: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  line_items: InvoiceLineItem[];
  created_at: string;
  updated_at: string;
  erp_reference_id?: string;
  last_synced_at?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_amount?: number;
}

// Configuration types
export interface SyncConfig {
  id?: string;
  tenant_id: string;
  auto_sync_enabled: boolean;
  sync_frequency: "realtime" | "5min" | "15min" | "30min" | "hourly" | "daily";
  sync_time_of_day?: string; // HH:MM format
  batch_size: number;
  parallel_connections: number;
  timeout_seconds: number;
  updated_at?: string;
}

export interface RetryPolicyConfig {
  id?: string;
  tenant_id: string;
  max_retries: number;
  initial_delay_seconds: number;
  max_delay_seconds: number;
  backoff_multiplier: number;
  retry_on_status_codes: number[];
  updated_at?: string;
}

export interface NotificationConfig {
  id?: string;
  tenant_id: string;
  email_notifications_enabled: boolean;
  notification_emails: string[];
  notify_on_sync_failure: boolean;
  notify_on_reconciliation_mismatch: boolean;
  notify_on_payment_failure: boolean;
  notify_on_high_value_transactions: boolean;
  high_value_threshold: number;
  slack_webhook_url?: string;
  teams_webhook_url?: string;
  updated_at?: string;
}

export interface SecurityConfig {
  id?: string;
  tenant_id: string;
  require_approval_for_payments_above: number;
  require_approval_for_config_changes: boolean;
  session_timeout_minutes: number;
  allowed_ip_ranges: string[];
  mfa_required: boolean;
  audit_log_retention_days: number;
  encryption_enabled: boolean;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  status: "success" | "failure";
  error_message?: string;
  created_at: string;
}

export interface DashboardMetrics {
  tenant_id: string;
  period: "today" | "week" | "month" | "year";
  transaction_volume: {
    total: number;
    by_type: Record<string, number>;
    trend: number; // percentage change
  };
  sync_performance: {
    total_syncs: number;
    successful_syncs: number;
    failed_syncs: number;
    success_rate: number;
    avg_duration_seconds: number;
  };
  reconciliation: {
    total_transactions: number;
    matched: number;
    unmatched: number;
    accuracy_rate: number;
    exceptions: number;
  };
  payments: {
    total_payments: number;
    total_amount: number;
    pending: number;
    completed: number;
    failed: number;
  };
  system_health: {
    active_connections: number;
    total_connections: number;
    api_response_time_ms: number;
    error_rate: number;
  };
}

export interface Exception {
  id: string;
  tenant_id: string;
  type:
    | "sync_failure"
    | "reconciliation_mismatch"
    | "payment_failure"
    | "validation_error";
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "resolved" | "ignored";
  title: string;
  description: string;
  resource_type?: string;
  resource_id?: string;
  data?: Record<string, any>;
  assigned_to?: string;
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

export interface Loan {
  id: string;
  tenant_id: string;
  customer_id: string;
  loan_number: string;
  loan_type: "personal" | "business" | "mortgage" | "auto" | "education";
  principal_amount: number;
  outstanding_balance: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  start_date: string;
  maturity_date: string;
  status: "active" | "paid_off" | "defaulted" | "suspended";
  currency: string;
  created_at: string;
  updated_at: string;
  next_payment_date?: string;
  next_payment_amount?: number;
}

export interface CashPosition {
  tenant_id: string;
  customer_id: string;
  as_of_date: string;
  total_cash: number;
  currency: string;
  accounts_breakdown: {
    account_id: string;
    account_name: string;
    balance: number;
  }[];
  projected_inflows: number;
  projected_outflows: number;
  projected_balance: number;
}

export interface CashForecast {
  tenant_id: string;
  customer_id: string;
  forecast_start_date: string;
  forecast_end_date: string;
  forecast_days: number;
  daily_forecast: {
    date: string;
    opening_balance: number;
    inflows: number;
    outflows: number;
    closing_balance: number;
  }[];
  total_inflows: number;
  total_outflows: number;
  ending_balance: number;
}

export interface ReconciliationItem {
  id: string;
  bank_transaction_id?: string;
  erp_transaction_id?: string;
  date: string;
  description: string;
  amount: number;
  status: "matched" | "unmatched" | "pending_review";
  match_confidence?: number;
}

export interface ReconciliationReport {
  account_id: string;
  account_name: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_matched: number;
  total_unmatched: number;
  items: ReconciliationItem[];
}

export interface SyncHistoryItem {
  sync_id: string;
  sync_type: "full" | "incremental";
  status: SyncStatus;
  started_at: string;
  completed_at?: string;
  records_synced: number;
  error_message?: string;
}

// API Functions
export const erpIntegrationApi = {
  // Connection Management
  listConnections: async (
    tenantId: string,
    customerId: string,
  ): Promise<{ connections: ERPConnection[] }> => {
    const response = await apiClient.get(`/erp/api/v1/connections`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  getConnection: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<ERPConnection> => {
    const response = await apiClient.get(
      `/erp/api/v1/connections/${connectionId}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  createConnection: async (
    tenantId: string,
    customerId: string,
    connectionData: Partial<ERPConnection>,
  ): Promise<ERPConnection> => {
    const response = await apiClient.post(
      `/erp/api/v1/connections`,
      connectionData,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  updateConnection: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
    connectionData: Partial<ERPConnection>,
  ): Promise<ERPConnection> => {
    const response = await apiClient.put(
      `/erp/api/v1/connections/${connectionId}`,
      connectionData,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  deleteConnection: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<void> => {
    await apiClient.delete(`/erp/api/v1/connections/${connectionId}`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
  },

  testConnection: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const response = await apiClient.post(
      `/erp/api/v1/connections/${connectionId}/test`,
      {},
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  triggerSync: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
    syncType: "full" | "incremental",
  ): Promise<{ sync_id: string; status: SyncStatus }> => {
    const response = await apiClient.post(
      `/erp/api/v1/connections/${connectionId}/sync`,
      {
        sync_type: syncType,
      },
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  getSyncHistory: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<{ syncs: SyncHistoryItem[] }> => {
    const response = await apiClient.get(
      `/erp/api/v1/sync/history?connection_id=${connectionId}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Bank Accounts
  listBankAccounts: async (
    tenantId: string,
    customerId: string,
  ): Promise<{ accounts: BankAccount[] }> => {
    const response = await apiClient.get(`/erp/api/v1/bank-accounts`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  getBankAccount: async (
    tenantId: string,
    customerId: string,
    accountId: string,
  ): Promise<BankAccount> => {
    const response = await apiClient.get(
      `/erp/api/v1/bank-accounts/${accountId}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  linkBankAccount: async (
    tenantId: string,
    customerId: string,
    accountId: string,
    erpConnectionId: string,
  ): Promise<BankAccount> => {
    const response = await apiClient.post(
      `/erp/api/v1/bank-accounts/${accountId}/link`,
      {
        erp_connection_id: erpConnectionId,
      },
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  unlinkBankAccount: async (
    tenantId: string,
    customerId: string,
    accountId: string,
  ): Promise<BankAccount> => {
    const response = await apiClient.post(
      `/erp/api/v1/bank-accounts/${accountId}/unlink`,
      {},
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Payments
  listPayments: async (
    tenantId: string,
    customerId: string,
    params?: { status?: string; start_date?: string; end_date?: string },
  ): Promise<{ payments: Payment[] }> => {
    const response = await apiClient.get(`/erp/api/v1/payments`, {
      params,
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  getPayment: async (
    tenantId: string,
    customerId: string,
    paymentId: string,
  ): Promise<Payment> => {
    const response = await apiClient.get(`/erp/api/v1/payments/${paymentId}`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  initiatePayment: async (
    tenantId: string,
    customerId: string,
    paymentData: Partial<Payment>,
  ): Promise<Payment> => {
    const response = await apiClient.post(`/erp/api/v1/payments`, paymentData, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  cancelPayment: async (
    tenantId: string,
    customerId: string,
    paymentId: string,
  ): Promise<Payment> => {
    const response = await apiClient.post(
      `/erp/api/v1/payments/${paymentId}/cancel`,
      {},
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Invoices
  listInvoices: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
    params?: { status?: string },
  ): Promise<{ invoices: Invoice[] }> => {
    const response = await apiClient.get(
      `/erp/api/v1/invoices?connection_id=${connectionId}`,
      {
        params,
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  getInvoice: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
    invoiceId: string,
  ): Promise<Invoice> => {
    const response = await apiClient.get(
      `/erp/api/v1/invoices/${invoiceId}?connection_id=${connectionId}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  syncInvoice: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
    invoiceId: string,
  ): Promise<Invoice> => {
    const response = await apiClient.post(
      `/erp/api/v1/sync/invoices`,
      {
        connection_id: connectionId,
        invoice_id: invoiceId,
      },
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Loans
  listLoans: async (
    tenantId: string,
    customerId: string,
  ): Promise<{ loans: Loan[] }> => {
    const response = await apiClient.get(`/erp/api/v1/loans`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  getLoan: async (
    tenantId: string,
    customerId: string,
    loanId: string,
  ): Promise<Loan> => {
    const response = await apiClient.get(`/erp/api/v1/loans/${loanId}`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  // Cash Management
  getCashPosition: async (
    tenantId: string,
    customerId: string,
    asOfDate?: string,
  ): Promise<CashPosition> => {
    const params = asOfDate ? { as_of_date: asOfDate } : {};
    const response = await apiClient.get(`/erp/api/v1/cash-position`, {
      params,
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  getCashForecast: async (
    tenantId: string,
    customerId: string,
    forecastDays: number,
  ): Promise<CashForecast> => {
    const response = await apiClient.get(
      `/erp/api/v1/cash-forecast?days=${forecastDays}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Reconciliation
  getReconciliationStatus: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<ReconciliationReport> => {
    const response = await apiClient.get(
      `/erp/api/v1/reconciliation/status?connection_id=${connectionId}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  autoReconcile: async (
    tenantId: string,
    customerId: string,
    data: {
      connection_id: string;
      account_id: string;
      start_date: string;
      end_date: string;
    },
  ): Promise<{ matched_count: number; unmatched_count: number }> => {
    const response = await apiClient.post(
      `/erp/api/v1/reconciliation/auto`,
      data,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  manualMatch: async (
    tenantId: string,
    customerId: string,
    data: {
      bank_transaction_id: string;
      erp_transaction_id: string;
    },
  ): Promise<ReconciliationItem> => {
    const response = await apiClient.post(
      `/erp/api/v1/reconciliation/manual`,
      data,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Sync Operations
  syncAccounts: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<any> => {
    const response = await apiClient.post(
      `/erp/api/v1/sync/accounts`,
      { connection_id: connectionId },
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  syncTransactions: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
    fromDate: string,
    toDate: string,
  ): Promise<any> => {
    const response = await apiClient.post(
      `/erp/api/v1/sync/transactions`,
      { connection_id: connectionId, from_date: fromDate, to_date: toDate },
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  syncInvoicesData: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<any> => {
    const response = await apiClient.post(
      `/erp/api/v1/sync/invoices`,
      { connection_id: connectionId },
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  getSyncStatus: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<any> => {
    const response = await apiClient.get(
      `/erp/api/v1/sync/status?connection_id=${connectionId}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Account Mappings
  listAccountMappings: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<any> => {
    const response = await apiClient.get(
      `/erp/api/v1/mappings/accounts?connection_id=${connectionId}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  createAccountMapping: async (
    tenantId: string,
    customerId: string,
    mapping: any,
  ): Promise<any> => {
    const response = await apiClient.post(
      `/erp/api/v1/mappings/accounts`,
      mapping,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  deleteAccountMapping: async (
    tenantId: string,
    customerId: string,
    mappingId: string,
  ): Promise<void> => {
    await apiClient.delete(`/erp/api/v1/mappings/accounts/${mappingId}`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
  },

  // Webhooks
  listWebhooks: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
  ): Promise<any> => {
    const response = await apiClient.get(
      `/erp/api/v1/webhooks?connection_id=${connectionId}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  createWebhook: async (
    tenantId: string,
    customerId: string,
    webhook: any,
  ): Promise<any> => {
    const response = await apiClient.post(`/erp/api/v1/webhooks`, webhook, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  deleteWebhook: async (
    tenantId: string,
    customerId: string,
    webhookId: string,
  ): Promise<void> => {
    await apiClient.delete(`/erp/api/v1/webhooks/${webhookId}`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
  },

  // Reports
  getReconciliationReport: async (
    tenantId: string,
    customerId: string,
    connectionId: string,
    fromDate: string,
    toDate: string,
  ): Promise<any> => {
    const response = await apiClient.get(
      `/erp/api/v1/reports/reconciliation?connection_id=${connectionId}&from_date=${fromDate}&to_date=${toDate}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  getCashFlowReport: async (
    tenantId: string,
    customerId: string,
    fromDate: string,
    toDate: string,
  ): Promise<any> => {
    const response = await apiClient.get(
      `/erp/api/v1/reports/cash-flow?from_date=${fromDate}&to_date=${toDate}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  getPaymentSummaryReport: async (
    tenantId: string,
    customerId: string,
    fromDate: string,
    toDate: string,
  ): Promise<any> => {
    const response = await apiClient.get(
      `/erp/api/v1/reports/payment-summary?from_date=${fromDate}&to_date=${toDate}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Loan Operations
  getLoanSchedule: async (
    tenantId: string,
    customerId: string,
    loanId: string,
  ): Promise<any> => {
    const response = await apiClient.get(
      `/erp/api/v1/loans/${loanId}/schedule`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  makeLoanPayment: async (
    tenantId: string,
    customerId: string,
    loanId: string,
    amount: number,
    sourceAccount: string,
  ): Promise<any> => {
    const response = await apiClient.post(
      `/erp/api/v1/loans/${loanId}/payment`,
      { amount, source_account: sourceAccount },
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Configuration Management
  getSyncConfig: async (
    tenantId: string,
    customerId: string,
  ): Promise<SyncConfig> => {
    const response = await apiClient.get(`/erp/api/v1/config/sync`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  updateSyncConfig: async (
    tenantId: string,
    customerId: string,
    config: Partial<SyncConfig>,
  ): Promise<SyncConfig> => {
    const response = await apiClient.put(`/erp/api/v1/config/sync`, config, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  getRetryPolicyConfig: async (
    tenantId: string,
    customerId: string,
  ): Promise<RetryPolicyConfig> => {
    const response = await apiClient.get(`/erp/api/v1/config/retry-policy`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  updateRetryPolicyConfig: async (
    tenantId: string,
    customerId: string,
    config: Partial<RetryPolicyConfig>,
  ): Promise<RetryPolicyConfig> => {
    const response = await apiClient.put(
      `/erp/api/v1/config/retry-policy`,
      config,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  getNotificationConfig: async (
    tenantId: string,
    customerId: string,
  ): Promise<NotificationConfig> => {
    const response = await apiClient.get(`/erp/api/v1/config/notifications`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  updateNotificationConfig: async (
    tenantId: string,
    customerId: string,
    config: Partial<NotificationConfig>,
  ): Promise<NotificationConfig> => {
    const response = await apiClient.put(
      `/erp/api/v1/config/notifications`,
      config,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  getSecurityConfig: async (
    tenantId: string,
    customerId: string,
  ): Promise<SecurityConfig> => {
    const response = await apiClient.get(`/erp/api/v1/config/security`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": customerId,
      },
    });
    return response.data;
  },

  updateSecurityConfig: async (
    tenantId: string,
    customerId: string,
    config: Partial<SecurityConfig>,
  ): Promise<SecurityConfig> => {
    const response = await apiClient.put(
      `/erp/api/v1/config/security`,
      config,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Audit Logs
  getAuditLogs: async (
    tenantId: string,
    customerId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      action?: string;
      user_id?: string;
      resource_type?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ logs: AuditLog[]; total: number }> => {
    const queryParams = new URLSearchParams(params as any).toString();
    const response = await apiClient.get(
      `/erp/api/v1/audit-logs${queryParams ? `?${queryParams}` : ""}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Dashboard Metrics
  getDashboardMetrics: async (
    tenantId: string,
    customerId: string,
    period: "today" | "week" | "month" | "year",
  ): Promise<DashboardMetrics> => {
    const response = await apiClient.get(
      `/erp/api/v1/dashboard/metrics?period=${period}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  // Exception Management
  listExceptions: async (
    tenantId: string,
    customerId: string,
    params?: {
      type?: string;
      severity?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ exceptions: Exception[]; total: number }> => {
    const queryParams = new URLSearchParams(params as any).toString();
    const response = await apiClient.get(
      `/erp/api/v1/exceptions${queryParams ? `?${queryParams}` : ""}`,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },

  updateException: async (
    tenantId: string,
    customerId: string,
    exceptionId: string,
    updates: Partial<Exception>,
  ): Promise<Exception> => {
    const response = await apiClient.put(
      `/erp/api/v1/exceptions/${exceptionId}`,
      updates,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-Customer-ID": customerId,
        },
      },
    );
    return response.data;
  },
};
