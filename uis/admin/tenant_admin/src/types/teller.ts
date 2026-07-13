// Teller System Types

export interface Teller {
  id: string;
  teller_id?: string;  // Alias for id
  user_id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "suspended" | "on_break";
  window_number?: string | number;  // Support both string and number
  till_id?: string;  // Assigned till
  assigned_till_id?: string;
  daily_transaction_limit: number;
  single_transaction_limit: number;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface TellerStats {
  teller_id: string;
  total_transactions: number;
  total_volume: number;
  deposits_count: number;
  deposits_volume: number;
  withdrawals_count: number;
  withdrawals_volume: number;
  average_transaction_time: number;
  today_transactions: number;
  today_volume: number;
  last_updated: string;
}

export interface Till {
  till_id: string;
  tenant_id: string;
  branch_id: string;
  teller_id?: string;
  window_number: number | string;  // Support both types
  status: "open" | "closed" | "balancing" | "maintenance";
  balances?: Record<string, TillBalance>;
  minimum_balance?: number;
  maximum_balance?: number;
  alert_threshold?: number;
  opening_cash?: number;
  closing_cash?: number;
  shortage_amount?: number;
  overage_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface DenominationBreakdown {
  n1000: number;
  n500: number;
  n200: number;
  n100: number;
  n50: number;
  n20: number;
  n10: number;
  n5: number;
}

// Simple denomination entry for UI forms
export interface Denomination {
  value: number;
  count: number;
}

// teller-service structured breakdown shape used by open/close till endpoints
export interface StructuredDenomination {
  value: number;
  currency: string;
  count: number;
  total: number;
}

export interface StructuredDenominationBreakdown {
  currency: string;
  denominations: StructuredDenomination[];
  total_amount: number;
  total_count: number;
}

export interface TillBalance {
  // Some endpoints (e.g. /queue/windows or /tills list) embed balances by currency.
  // Other endpoints (e.g. /tills/{id}/balance) may return an aggregate balance.
  // Keep this interface flexible to support both shapes while staying type-safe.
  currency?: string;
  till_id?: string;
  current_balance: number;
  opening_balance: number;

  // Backend (teller-service) field names
  total_deposits?: number;
  total_withdrawals?: number;

  // Legacy/alternate field names used elsewhere in the UI
  deposit_total?: number;
  withdrawal_total?: number;

  expected_balance?: number;
  actual_balance?: number;
  shortage_overage?: number;
  denomination_breakdown: DenominationBreakdown;
  last_balanced_at?: string;
}

export interface Vault {
  // New teller-service shape
  vault_id: string;
  tenant_id: string;
  branch_id: string;
  vault_name: string;
  status: "open" | "closed" | "counting" | "maintenance";
  balances: Record<string, VaultCurrencyBalance>;
  requires_dual_control: boolean;
  minimum_balance: number;
  maximum_balance: number;
  reorder_point?: number;
  created_at: string;
  updated_at: string;

  // Legacy fields kept for backward compatibility with older UI code.
  id?: string;
  vault_number?: string;
  current_balance?: number;
  available_balance?: number;
  reserved_balance?: number;
  dual_control_required?: boolean;
  custodian_1_id?: string;
  custodian_2_id?: string;
  opened_at?: string;
  closed_at?: string;
  last_audit_date?: string;
  next_audit_date?: string;
  denomination_breakdown?: DenominationBreakdown;
}

export interface VaultCurrencyBalance {
  currency: string;
  current_balance: number;
  reserved_balance: number;
  available_balance: number;
  denomination_breakdown: StructuredDenominationBreakdown;
}

export interface VaultBalance {
  vault_id: string;
  current_balance: number;
  available_balance: number;
  reserved_balance: number;
  denomination_breakdown: DenominationBreakdown;
  last_counted_at?: string;
}

export interface TillTransfer {
  id: string;
  // Backend may omit transfer_type; UI should handle missing/derived values.
  transfer_type?: "till_to_vault" | "vault_to_till" | "till_to_till";
  source_type: "till" | "vault";
  source_id: string;
  // Backend uses dest_type/dest_id; UI historically used destination_*.
  destination_type?: "till" | "vault";
  destination_id?: string;
  dest_type?: "till" | "vault" | "";
  dest_id?: string;
  amount: number;
  currency?: string;
  denomination_breakdown?:
    | DenominationBreakdown
    | StructuredDenominationBreakdown;
  status: "pending" | "approved" | "rejected" | "completed";
  // Backend uses requested_by
  initiated_by?: string;
  requested_by?: string;
  approved_by?: string;
  rejected_by?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  transaction_type:
    | "cash_deposit"
    | "cash_withdrawal"
    | "check_deposit"
    | "check_cashing"
    | "transfer";
  teller_id: string;
  till_id?: string;
  customer_id: string;
  account_number: string;
  amount: number;
  currency: string;
  denomination_breakdown?: DenominationBreakdown | StructuredDenominationBreakdown;
  status: "pending" | "approved" | "rejected" | "completed" | "reversed";
  requires_approval: boolean;
  approval_status?: "pending" | "approved" | "rejected";
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  reversed: boolean;
  reversed_by?: string;
  reversed_at?: string;
  reversal_reason?: string;
  reference_number: string;
  check_number?: string;
  check_details?: CheckDetails;
  transaction_notes?: string;
  customer_verification_method?: string;
  created_at: string;
  updated_at: string;
}

export interface CheckDetails {
  check_number: string;
  check_date: string;
  drawer_account: string;
  drawer_name: string;
  bank_name: string;
  bank_code?: string;
  check_image_url?: string;
  hold_period_days: number;
  available_date: string;
  clearing_status: "pending" | "clearing" | "cleared" | "returned" | "bounced";
}

export interface CTRReport {
  id: string;
  report_number: string;
  teller_id: string;
  customer_id: string;
  transaction_ids: string[];
  total_amount: number;
  transaction_type: "deposit" | "withdrawal" | "mixed";
  status: "draft" | "filed" | "pending_review";
  filed_by?: string;
  filed_at?: string;
  regulator_response?: string;
  created_at: string;
  updated_at: string;
}

export interface EODReport {
  id: string;
  report_number: string;
  report_date: string;
  branch_id: string;
  teller_id?: string;
  opening_balance: number;
  closing_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_transactions: number;
  cash_in_hand: number;
  shortage_overage: number;
  till_summaries: TillSummary[];
  vault_summaries: VaultSummary[];
  status: "draft" | "submitted" | "verified" | "approved" | "rejected";
  verified_by?: string;
  verified_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TillSummary {
  till_id: string;
  till_number: string;
  teller_name: string;
  opening_balance: number;
  closing_balance: number;
  deposits: number;
  withdrawals: number;
  shortage_overage: number;
}

export interface VaultSummary {
  vault_id: string;
  vault_number: string;
  opening_balance: number;
  closing_balance: number;
  transfers_in: number;
  transfers_out: number;
}

export interface QueueTicket {
  id: string;
  ticket_number: string;
  customer_id?: string;
  customer_name: string;
  service_type:
    | "deposit"
    | "withdrawal"
    | "inquiry"
    | "account_opening"
    | "loan"
    | "other";
  priority: "normal" | "high" | "urgent";
  status:
    | "waiting"
    | "called"
    | "serving"
    | "completed"
    | "cancelled"
    | "no_show";
  assigned_window?: string;
  assigned_teller_id?: string;
  issued_at: string;
  called_at?: string;
  serving_started_at?: string;
  completed_at?: string;
  wait_time_minutes?: number;
  service_time_minutes?: number;
  estimated_wait_minutes?: number;
  notes?: string;
}

export interface QueueStats {
  total_waiting: number;
  total_serving: number;
  total_completed_today: number;
  average_wait_time: number;
  average_service_time: number;
  longest_wait_time: number;
  tickets_by_service_type: Record<string, number>;
  tickets_by_status: Record<string, number>;
}

export interface WindowStatus {
  window_number: string;
  teller_id?: string;
  teller_name?: string;
  status: "available" | "busy" | "on_break" | "closed";
  current_ticket?: QueueTicket;
  tickets_served_today: number;
  average_service_time: number;
}

// Request/Response types
export interface RegisterTellerRequest {
  user_id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  daily_transaction_limit: number;
  single_transaction_limit: number;
}

export interface UpdateTellerStatusRequest {
  status: "active" | "inactive" | "suspended" | "on_break";
  reason?: string;
}

export interface UpdateTellerAssignmentRequest {
  window_number?: string;
  assigned_till_id?: string;
}

export interface CreateTillRequest {
  window_number: number;
  minimum_balance?: number;
  maximum_balance?: number;
  alert_threshold?: number;
  status?: "open" | "closed" | "balancing" | "maintenance";
}

export interface OpenTillRequest {
  teller_id: string;
  // Backend expects opening cash at open time.
  opening_cash: number;
  // Kept for backward compatibility with older UI code.
  opening_balance?: number;
  denomination_breakdown:
    | DenominationBreakdown
    | StructuredDenominationBreakdown;
}

export interface CloseTillRequest {
  teller_id: string;
  // Backend expects closing cash at close time.
  closing_cash: number;
  // Kept for backward compatibility with older UI code.
  closing_balance?: number;
  denomination_breakdown:
    | DenominationBreakdown
    | StructuredDenominationBreakdown;
  notes?: string;
}

export interface CreateVaultRequest {
  // New teller-service create shape (field names may vary by deployment).
  vault_name?: string;
  requires_dual_control?: boolean;
  reorder_point?: number;

  // Legacy fields still accepted by older UI/backends.
  vault_number?: string;
  dual_control_required?: boolean;

  branch_id: string;
  minimum_balance: number;
  maximum_balance: number;
}

export interface OpenVaultRequest {
  custodian_1_id: string;
  custodian_2_id?: string;

  // Backend (teller-service) expects these field names.
  primary_authorizer_id?: string;
  secondary_authorizer_id?: string;
}

export interface CloseVaultRequest {
  custodian_1_id: string;
  custodian_2_id?: string;
  notes?: string;
}

export interface StartVaultCountRequest {
  custodian_1_id: string;
  custodian_2_id?: string;
}

export interface CompleteVaultCountRequest {
  actual_balance: number;
  denomination_breakdown: DenominationBreakdown;
  custodian_1_id: string;
  custodian_2_id?: string;
  notes?: string;
}

export interface CreateTillTransferRequest {
  transfer_type: "till_to_vault" | "vault_to_till" | "till_to_till";
  source_type: "till" | "vault";
  source_id: string;
  destination_type: "till" | "vault";
  destination_id: string;
  // Backend field names
  dest_type?: "till" | "vault";
  dest_id?: string;
  amount: number;
  currency?: string;
  denomination_breakdown?:
    | DenominationBreakdown
    | StructuredDenominationBreakdown;
  notes?: string;
}

export interface CashDepositRequest {
  teller_id?: string;
  customer_id: string;
  account_number: string;
  account_id?: number;
  amount: number;
  denomination_breakdown: DenominationBreakdown;
  transaction_notes?: string;
}

export interface CashWithdrawalRequest {
  teller_id?: string;
  customer_id: string;
  account_number: string;
  account_id?: number;
  amount: number;
  denomination_breakdown?: DenominationBreakdown;
  transaction_notes?: string;
}

export interface CheckDepositRequest {
  teller_id?: string;
  customer_id: string;
  account_number: string;
  amount: number;
  check_details: CheckDetails;
  transaction_notes?: string;
}

export interface CheckCashingRequest {
  customer_id: string;
  amount: number;
  check_details: CheckDetails;
  denomination_breakdown?: DenominationBreakdown;
  transaction_notes?: string;
}

export interface ApproveTransactionRequest {
  approval_notes?: string;
}

export interface RejectTransactionRequest {
  rejection_reason: string;
}

export interface ReverseTransactionRequest {
  reversal_reason: string;
}

export interface IssueTicketRequest {
  customer_id?: string;
  customer_name: string;
  service_type:
    | "deposit"
    | "withdrawal"
    | "inquiry"
    | "account_opening"
    | "loan"
    | "other";
  priority?: "normal" | "high" | "urgent";
  notes?: string;
}

export interface TransferTicketRequest {
  target_window: string;
  reason?: string;
}

export interface ListTellersParams {
  status?: string;
  page?: number;
  limit?: number;
}

export interface ListTillsParams {
  status?: string;
  assigned_teller_id?: string;
  page?: number;
  limit?: number;
}

export interface ListVaultsParams {
  status?: string;
  branch_id?: string;
  page?: number;
  limit?: number;
}

export interface ListTransactionsParams {
  teller_id?: string;
  transaction_type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface ListTransfersParams {
  source_id?: string;
  destination_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ListQueueTicketsParams {
  status?: string;
  service_type?: string;
  assigned_teller_id?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
