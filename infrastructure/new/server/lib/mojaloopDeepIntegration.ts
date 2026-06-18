/**
 * Deep Mojaloop Integration — FSPIOP Callbacks, ILP, Settlement Windows,
 * Admin API, Cross-Border Corridors, TigerBeetle Bridging
 *
 * Services:
 * - mojaloop-fspiop-callbacks-rs (Rust :8267) — async FSPIOP callbacks + ILP
 * - mojaloop-settlement-mgr-go (Go :8268) — settlement window lifecycle
 * - mojaloop-admin-go (Go :8269) — participant onboarding, limits, endpoints
 * - mojaloop-crossborder-py (Python :8270) — corridor routing, compliance
 * - mojaloop-tb-bridge-rs (Rust :8271) — TigerBeetle ledger bridging
 */

// ── 1. FSPIOP Callback Handling ──

interface FSPIOPCallback {
  id: string;
  type: "PUT" | "PATCH";
  resource: "parties" | "quotes" | "transfers" | "transactionRequests" | "authorizations";
  resourceId: string;
  sourceFsp: string;
  destFsp: string;
  status: "received" | "processed" | "error" | "timeout";
  httpStatusCode: number;
  payload: Record<string, unknown>;
  receivedAt: string;
  processedAt: string | null;
  latencyMs: number;
  correlationId: string;
}

interface CallbackEndpoint {
  id: string;
  fspId: string;
  type: "FSPIOP_CALLBACK_URL_PARTIES_GET" | "FSPIOP_CALLBACK_URL_PARTIES_PUT" | "FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR" | "FSPIOP_CALLBACK_URL_QUOTES" | "FSPIOP_CALLBACK_URL_TRANSFER_POST" | "FSPIOP_CALLBACK_URL_TRANSFER_PUT" | "FSPIOP_CALLBACK_URL_TRANSFER_ERROR" | "FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST" | "FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT";
  url: string;
  status: "active" | "inactive" | "error";
  lastCalledAt: string;
  successRate: number;
  avgLatencyMs: number;
}

const fspiopCallbacks: FSPIOPCallback[] = [
  { id: "CB-001", type: "PUT", resource: "parties", resourceId: "MSISDN/2348012345678", sourceFsp: "MOJALOOP-HUB", destFsp: "54BANK", status: "processed", httpStatusCode: 200, payload: { party: { partyIdInfo: { partyIdType: "MSISDN", partyIdentifier: "2348012345678", fspId: "54BANK" }, name: "Adebayo Ogundimu", personalInfo: { dateOfBirth: "1985-03-15" } } }, receivedAt: new Date(Date.now() - 5000).toISOString(), processedAt: new Date(Date.now() - 4950).toISOString(), latencyMs: 50, correlationId: "COR-PARTY-001" },
  { id: "CB-002", type: "PUT", resource: "quotes", resourceId: "QUO-54BANK-001", sourceFsp: "GTBANK", destFsp: "54BANK", status: "processed", httpStatusCode: 200, payload: { transferAmount: { amount: "50000", currency: "NGN" }, payeeReceiveAmount: { amount: "49750", currency: "NGN" }, fees: { amount: "250", currency: "NGN" }, condition: "GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf7LRvCh44ggps", expiration: new Date(Date.now() + 3600000).toISOString() }, receivedAt: new Date(Date.now() - 3000).toISOString(), processedAt: new Date(Date.now() - 2980).toISOString(), latencyMs: 20, correlationId: "COR-QUOTE-001" },
  { id: "CB-003", type: "PUT", resource: "transfers", resourceId: "TXN-MOJA-54BANK-001", sourceFsp: "MOJALOOP-HUB", destFsp: "54BANK", status: "processed", httpStatusCode: 200, payload: { fulfilment: "UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA", completedTimestamp: new Date().toISOString(), transferState: "COMMITTED" }, receivedAt: new Date(Date.now() - 1000).toISOString(), processedAt: new Date(Date.now() - 985).toISOString(), latencyMs: 15, correlationId: "COR-TXN-001" },
  { id: "CB-004", type: "PUT", resource: "transfers", resourceId: "TXN-MOJA-54BANK-002", sourceFsp: "MOJALOOP-HUB", destFsp: "54BANK", status: "error", httpStatusCode: 500, payload: { errorInformation: { errorCode: "5100", errorDescription: "Payee FSP rejected transaction", extensionList: { extension: [{ key: "cause", value: "Account frozen" }] } } }, receivedAt: new Date(Date.now() - 800).toISOString(), processedAt: new Date(Date.now() - 790).toISOString(), latencyMs: 10, correlationId: "COR-TXN-002" },
  { id: "CB-005", type: "PUT", resource: "parties", resourceId: "ACCOUNT_ID/ACCESS-SAV-001", sourceFsp: "ACCESSBANK", destFsp: "54BANK", status: "processed", httpStatusCode: 200, payload: { party: { partyIdInfo: { partyIdType: "ACCOUNT_ID", partyIdentifier: "ACCESS-SAV-001", fspId: "ACCESSBANK" }, name: "Chidinma Nwosu" } }, receivedAt: new Date(Date.now() - 500).toISOString(), processedAt: new Date(Date.now() - 488).toISOString(), latencyMs: 12, correlationId: "COR-PARTY-002" },
];

const callbackEndpoints: CallbackEndpoint[] = [
  { id: "EP-001", fspId: "54BANK", type: "FSPIOP_CALLBACK_URL_PARTIES_PUT", url: "https://api.54bank.app/mojaloop/callbacks/parties/{Type}/{ID}", status: "active", lastCalledAt: new Date().toISOString(), successRate: 0.998, avgLatencyMs: 35 },
  { id: "EP-002", fspId: "54BANK", type: "FSPIOP_CALLBACK_URL_QUOTES", url: "https://api.54bank.app/mojaloop/callbacks/quotes/{ID}", status: "active", lastCalledAt: new Date().toISOString(), successRate: 0.997, avgLatencyMs: 22 },
  { id: "EP-003", fspId: "54BANK", type: "FSPIOP_CALLBACK_URL_TRANSFER_POST", url: "https://api.54bank.app/mojaloop/callbacks/transfers", status: "active", lastCalledAt: new Date().toISOString(), successRate: 0.999, avgLatencyMs: 18 },
  { id: "EP-004", fspId: "54BANK", type: "FSPIOP_CALLBACK_URL_TRANSFER_PUT", url: "https://api.54bank.app/mojaloop/callbacks/transfers/{ID}", status: "active", lastCalledAt: new Date().toISOString(), successRate: 0.999, avgLatencyMs: 15 },
  { id: "EP-005", fspId: "54BANK", type: "FSPIOP_CALLBACK_URL_TRANSFER_ERROR", url: "https://api.54bank.app/mojaloop/callbacks/transfers/{ID}/error", status: "active", lastCalledAt: new Date().toISOString(), successRate: 1.0, avgLatencyMs: 12 },
  { id: "EP-006", fspId: "54BANK", type: "FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST", url: "https://api.54bank.app/mojaloop/callbacks/bulkTransfers", status: "active", lastCalledAt: new Date().toISOString(), successRate: 0.995, avgLatencyMs: 45 },
  { id: "EP-007", fspId: "GTBANK", type: "FSPIOP_CALLBACK_URL_TRANSFER_PUT", url: "https://api.gtbank.com/mojaloop/callbacks/transfers/{ID}", status: "active", lastCalledAt: new Date().toISOString(), successRate: 0.996, avgLatencyMs: 28 },
  { id: "EP-008", fspId: "ACCESSBANK", type: "FSPIOP_CALLBACK_URL_TRANSFER_PUT", url: "https://api.accessbankplc.com/mojaloop/callbacks/transfers/{ID}", status: "active", lastCalledAt: new Date().toISOString(), successRate: 0.994, avgLatencyMs: 32 },
];

// ── 2. ILP (Interledger Protocol) Packet Handling ──

interface ILPPacket {
  id: string;
  transferId: string;
  condition: string;
  fulfilment: string | null;
  ilpPacketBase64: string;
  amount: number;
  currency: string;
  payerFsp: string;
  payeeFsp: string;
  expiresAt: string;
  status: "pending" | "fulfilled" | "rejected" | "expired";
  createdAt: string;
  fulfilledAt: string | null;
  verificationResult: "valid" | "invalid" | "pending";
}

const ilpPackets: ILPPacket[] = [
  { id: "ILP-001", transferId: "TXN-MOJA-54BANK-001", condition: "GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf7LRvCh44ggps", fulfilment: "UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA", ilpPacketBase64: "AQAAAAAAAADIEHByaXZhdGUucGF5ZWVmc3AB...", amount: 5000000, currency: "NGN", payerFsp: "54BANK", payeeFsp: "GTBANK", expiresAt: new Date(Date.now() + 3600000).toISOString(), status: "fulfilled", createdAt: new Date(Date.now() - 60000).toISOString(), fulfilledAt: new Date(Date.now() - 59000).toISOString(), verificationResult: "valid" },
  { id: "ILP-002", transferId: "TXN-MOJA-54BANK-003", condition: "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU", fulfilment: null, ilpPacketBase64: "AQAAAAAAAABkEHByaXZhdGUucGF5ZWVmc3AC...", amount: 25000000, currency: "NGN", payerFsp: "ACCESSBANK", payeeFsp: "54BANK", expiresAt: new Date(Date.now() + 1800000).toISOString(), status: "pending", createdAt: new Date(Date.now() - 5000).toISOString(), fulfilledAt: null, verificationResult: "pending" },
  { id: "ILP-003", transferId: "TXN-MOJA-XBORDER-001", condition: "mhPc9l2tOKhMMhG1FoQF2x0JIUVaFTmyZ89J-qM8wYo", fulfilment: "x56dW2VjZ1RkFG0y9WaSPB0gg7x3KZWJ0FHxRBXK_Xo", ilpPacketBase64: "AQAAAAAAAAPoEHByaXZhdGUucGF5ZWVmc3AD...", amount: 100000, currency: "USD", payerFsp: "54BANK", payeeFsp: "ECOBANK-GH", expiresAt: new Date(Date.now() + 7200000).toISOString(), status: "fulfilled", createdAt: new Date(Date.now() - 120000).toISOString(), fulfilledAt: new Date(Date.now() - 118000).toISOString(), verificationResult: "valid" },
  { id: "ILP-004", transferId: "TXN-MOJA-54BANK-004", condition: "Pz37wrPQQC9QE0r2S9LGvnqhq5hl6Ur2IFnwO2IiKSQ", fulfilment: null, ilpPacketBase64: "AQAAAAAAAAGQEHByaXZhdGUucGF5ZWVmc3AE...", amount: 1500000, currency: "NGN", payerFsp: "ZENITHBANK", payeeFsp: "54BANK", expiresAt: new Date(Date.now() - 1000).toISOString(), status: "expired", createdAt: new Date(Date.now() - 7200000).toISOString(), fulfilledAt: null, verificationResult: "invalid" },
];

// ── 3. Settlement Window Management ──

interface SettlementWindow {
  id: string;
  reason: string;
  state: "OPEN" | "CLOSED" | "PENDING_SETTLEMENT" | "SETTLED" | "ABORTED";
  createdDate: string;
  changedDate: string;
  transferCount: number;
  totalAmount: number;
  currency: string;
  netPositions: { fspId: string; amount: number; direction: "PAYER_DFSP" | "PAYEE_DFSP" }[];
}

interface SettlementModel {
  id: string;
  name: string;
  settlementGranularity: "GROSS" | "NET";
  settlementInterchange: "BILATERAL" | "MULTILATERAL";
  settlementDelay: "IMMEDIATE" | "DEFERRED";
  requireLiquidityCheck: boolean;
  ledgerAccountType: "POSITION" | "SETTLEMENT";
  autoPositionReset: boolean;
  currency: string;
  isActive: boolean;
}

const settlementWindows: SettlementWindow[] = [
  { id: "SW-001", reason: "Scheduled EOD settlement window", state: "SETTLED", createdDate: new Date(Date.now() - 86400000).toISOString(), changedDate: new Date(Date.now() - 79200000).toISOString(), transferCount: 45200, totalAmount: 8945000000000, currency: "NGN", netPositions: [
    { fspId: "54BANK", amount: 125000000000, direction: "PAYEE_DFSP" },
    { fspId: "GTBANK", amount: -45000000000, direction: "PAYER_DFSP" },
    { fspId: "ACCESSBANK", amount: -30000000000, direction: "PAYER_DFSP" },
    { fspId: "ZENITHBANK", amount: -50000000000, direction: "PAYER_DFSP" },
  ]},
  { id: "SW-002", reason: "Intraday settlement — high value transfers", state: "SETTLED", createdDate: new Date(Date.now() - 43200000).toISOString(), changedDate: new Date(Date.now() - 39600000).toISOString(), transferCount: 1250, totalAmount: 2500000000000, currency: "NGN", netPositions: [
    { fspId: "54BANK", amount: -80000000000, direction: "PAYER_DFSP" },
    { fspId: "GTBANK", amount: 55000000000, direction: "PAYEE_DFSP" },
    { fspId: "ACCESSBANK", amount: 25000000000, direction: "PAYEE_DFSP" },
  ]},
  { id: "SW-003", reason: "Current settlement window", state: "OPEN", createdDate: new Date(Date.now() - 7200000).toISOString(), changedDate: new Date(Date.now() - 3600000).toISOString(), transferCount: 18500, totalAmount: 3200000000000, currency: "NGN", netPositions: [
    { fspId: "54BANK", amount: 42000000000, direction: "PAYEE_DFSP" },
    { fspId: "GTBANK", amount: -18000000000, direction: "PAYER_DFSP" },
    { fspId: "ZENITHBANK", amount: -24000000000, direction: "PAYER_DFSP" },
  ]},
  { id: "SW-004", reason: "Cross-border WAEMU corridor settlement", state: "PENDING_SETTLEMENT", createdDate: new Date(Date.now() - 10800000).toISOString(), changedDate: new Date(Date.now() - 7200000).toISOString(), transferCount: 320, totalAmount: 50000000, currency: "USD", netPositions: [
    { fspId: "54BANK", amount: -12000000, direction: "PAYER_DFSP" },
    { fspId: "ECOBANK-GH", amount: 8000000, direction: "PAYEE_DFSP" },
    { fspId: "STANBIC-KE", amount: 4000000, direction: "PAYEE_DFSP" },
  ]},
];

const settlementModels: SettlementModel[] = [
  { id: "SM-001", name: "Deferred Net Settlement (NIP)", settlementGranularity: "NET", settlementInterchange: "MULTILATERAL", settlementDelay: "DEFERRED", requireLiquidityCheck: true, ledgerAccountType: "POSITION", autoPositionReset: true, currency: "NGN", isActive: true },
  { id: "SM-002", name: "Real-Time Gross Settlement (RTGS)", settlementGranularity: "GROSS", settlementInterchange: "BILATERAL", settlementDelay: "IMMEDIATE", requireLiquidityCheck: true, ledgerAccountType: "SETTLEMENT", autoPositionReset: false, currency: "NGN", isActive: true },
  { id: "SM-003", name: "Cross-Border Net Settlement", settlementGranularity: "NET", settlementInterchange: "MULTILATERAL", settlementDelay: "DEFERRED", requireLiquidityCheck: true, ledgerAccountType: "POSITION", autoPositionReset: true, currency: "USD", isActive: true },
];

// ── 4. Admin API — Participant Onboarding ──

interface MojaloopParticipant {
  id: string;
  name: string;
  fspId: string;
  type: "DFSP" | "HUB" | "PISP" | "AISP";
  currency: string[];
  status: "active" | "suspended" | "onboarding" | "deregistered";
  ndcLimit: number;
  currentPosition: number;
  endpoints: number;
  createdAt: string;
  country: string;
  region: string;
  regulatoryLicense: string;
}

interface ParticipantLimit {
  id: string;
  fspId: string;
  limitType: "NET_DEBIT_CAP" | "MAX_SINGLE_TRANSFER" | "DAILY_TRANSFER_LIMIT" | "MONTHLY_TRANSFER_LIMIT";
  value: number;
  currency: string;
  currentUsage: number;
  utilizationPct: number;
  alarmThreshold: number;
  status: "active" | "breached" | "warning";
}

const participants: MojaloopParticipant[] = [
  { id: "PART-001", name: "54Bank Nigeria", fspId: "54BANK", type: "DFSP", currency: ["NGN", "USD", "GBP", "EUR"], status: "active", ndcLimit: 500000000000, currentPosition: 42000000000, endpoints: 8, createdAt: new Date(Date.now() - 365 * 86400000).toISOString(), country: "Nigeria", region: "West Africa", regulatoryLicense: "CBN/DMB/054/2024" },
  { id: "PART-002", name: "Guaranty Trust Bank", fspId: "GTBANK", type: "DFSP", currency: ["NGN", "USD"], status: "active", ndcLimit: 750000000000, currentPosition: -18000000000, endpoints: 6, createdAt: new Date(Date.now() - 300 * 86400000).toISOString(), country: "Nigeria", region: "West Africa", regulatoryLicense: "CBN/DMB/058/2024" },
  { id: "PART-003", name: "Access Bank PLC", fspId: "ACCESSBANK", type: "DFSP", currency: ["NGN", "USD", "GBP"], status: "active", ndcLimit: 600000000000, currentPosition: 25000000000, endpoints: 6, createdAt: new Date(Date.now() - 280 * 86400000).toISOString(), country: "Nigeria", region: "West Africa", regulatoryLicense: "CBN/DMB/044/2024" },
  { id: "PART-004", name: "Zenith Bank PLC", fspId: "ZENITHBANK", type: "DFSP", currency: ["NGN", "USD"], status: "active", ndcLimit: 700000000000, currentPosition: -24000000000, endpoints: 6, createdAt: new Date(Date.now() - 250 * 86400000).toISOString(), country: "Nigeria", region: "West Africa", regulatoryLicense: "CBN/DMB/057/2024" },
  { id: "PART-005", name: "Flutterwave", fspId: "FLUTTERWAVE", type: "PISP", currency: ["NGN", "USD", "KES", "GHS", "ZAR"], status: "active", ndcLimit: 200000000000, currentPosition: 5000000000, endpoints: 4, createdAt: new Date(Date.now() - 200 * 86400000).toISOString(), country: "Nigeria", region: "Pan-African", regulatoryLicense: "CBN/PSP/FL/2024" },
  { id: "PART-006", name: "Ecobank Ghana", fspId: "ECOBANK-GH", type: "DFSP", currency: ["GHS", "USD"], status: "active", ndcLimit: 100000000000, currentPosition: 8000000, endpoints: 4, createdAt: new Date(Date.now() - 90 * 86400000).toISOString(), country: "Ghana", region: "West Africa", regulatoryLicense: "BOG/DMB/ECO/2024" },
  { id: "PART-007", name: "Stanbic Bank Kenya", fspId: "STANBIC-KE", type: "DFSP", currency: ["KES", "USD"], status: "active", ndcLimit: 80000000000, currentPosition: 4000000, endpoints: 4, createdAt: new Date(Date.now() - 60 * 86400000).toISOString(), country: "Kenya", region: "East Africa", regulatoryLicense: "CBK/DMB/STN/2024" },
  { id: "PART-008", name: "Standard Bank SA", fspId: "STANDARDBANK-ZA", type: "DFSP", currency: ["ZAR", "USD"], status: "onboarding", ndcLimit: 0, currentPosition: 0, endpoints: 0, createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), country: "South Africa", region: "Southern Africa", regulatoryLicense: "SARB/DMB/SB/2024" },
  { id: "PART-009", name: "Mojaloop Switch Hub", fspId: "MOJALOOP-HUB", type: "HUB", currency: ["NGN", "USD", "GHS", "KES", "ZAR", "GBP", "EUR"], status: "active", ndcLimit: 0, currentPosition: 0, endpoints: 12, createdAt: new Date(Date.now() - 365 * 86400000).toISOString(), country: "Global", region: "Hub", regulatoryLicense: "N/A" },
];

const participantLimits: ParticipantLimit[] = [
  { id: "LIM-001", fspId: "54BANK", limitType: "NET_DEBIT_CAP", value: 500000000000, currency: "NGN", currentUsage: 42000000000, utilizationPct: 8.4, alarmThreshold: 80, status: "active" },
  { id: "LIM-002", fspId: "54BANK", limitType: "MAX_SINGLE_TRANSFER", value: 10000000000, currency: "NGN", currentUsage: 0, utilizationPct: 0, alarmThreshold: 90, status: "active" },
  { id: "LIM-003", fspId: "54BANK", limitType: "DAILY_TRANSFER_LIMIT", value: 100000000000, currency: "NGN", currentUsage: 35000000000, utilizationPct: 35, alarmThreshold: 85, status: "active" },
  { id: "LIM-004", fspId: "GTBANK", limitType: "NET_DEBIT_CAP", value: 750000000000, currency: "NGN", currentUsage: 18000000000, utilizationPct: 2.4, alarmThreshold: 80, status: "active" },
  { id: "LIM-005", fspId: "ACCESSBANK", limitType: "NET_DEBIT_CAP", value: 600000000000, currency: "NGN", currentUsage: 0, utilizationPct: 0, alarmThreshold: 80, status: "active" },
  { id: "LIM-006", fspId: "ZENITHBANK", limitType: "NET_DEBIT_CAP", value: 700000000000, currency: "NGN", currentUsage: 24000000000, utilizationPct: 3.4, alarmThreshold: 80, status: "active" },
  { id: "LIM-007", fspId: "FLUTTERWAVE", limitType: "NET_DEBIT_CAP", value: 200000000000, currency: "NGN", currentUsage: 0, utilizationPct: 0, alarmThreshold: 75, status: "active" },
  { id: "LIM-008", fspId: "54BANK", limitType: "MONTHLY_TRANSFER_LIMIT", value: 2000000000000, currency: "NGN", currentUsage: 850000000000, utilizationPct: 42.5, alarmThreshold: 90, status: "active" },
];

// ── 5. Cross-Border Corridor Support ──

interface CrossBorderCorridor {
  id: string;
  name: string;
  sourceFsp: string;
  sourceCountry: string;
  sourceCurrency: string;
  destFsp: string;
  destCountry: string;
  destCurrency: string;
  region: "WAEMU" | "SADC" | "EAC" | "ECOWAS" | "PAN_AFRICAN";
  exchangeRate: number;
  fees: { fixedFee: number; percentageFee: number; currency: string };
  complianceChecks: string[];
  avgTransferTimeMs: number;
  dailyVolume: number;
  dailyValue: number;
  status: "active" | "suspended" | "piloting";
  regulatoryApproval: string;
}

const corridors: CrossBorderCorridor[] = [
  { id: "CORR-001", name: "Nigeria → Ghana (NGN/GHS)", sourceFsp: "54BANK", sourceCountry: "Nigeria", sourceCurrency: "NGN", destFsp: "ECOBANK-GH", destCountry: "Ghana", destCurrency: "GHS", region: "ECOWAS", exchangeRate: 0.0076, fees: { fixedFee: 500, percentageFee: 0.5, currency: "NGN" }, complianceChecks: ["AML_SCREENING", "SANCTIONS_CHECK", "SOURCE_OF_FUNDS", "CBN_CROSS_BORDER_APPROVAL"], avgTransferTimeMs: 8500, dailyVolume: 1250, dailyValue: 45000000000, status: "active", regulatoryApproval: "CBN/FX/XBORDER/2024-001" },
  { id: "CORR-002", name: "Nigeria → Kenya (NGN/KES)", sourceFsp: "54BANK", sourceCountry: "Nigeria", sourceCurrency: "NGN", destFsp: "STANBIC-KE", destCountry: "Kenya", destCurrency: "KES", region: "PAN_AFRICAN", exchangeRate: 0.087, fees: { fixedFee: 750, percentageFee: 0.75, currency: "NGN" }, complianceChecks: ["AML_SCREENING", "SANCTIONS_CHECK", "CBN_CROSS_BORDER_APPROVAL", "CBK_INBOUND_APPROVAL"], avgTransferTimeMs: 12000, dailyVolume: 450, dailyValue: 18000000000, status: "active", regulatoryApproval: "CBN/FX/XBORDER/2024-002" },
  { id: "CORR-003", name: "Nigeria → South Africa (NGN/ZAR)", sourceFsp: "54BANK", sourceCountry: "Nigeria", sourceCurrency: "NGN", destFsp: "STANDARDBANK-ZA", destCountry: "South Africa", destCurrency: "ZAR", region: "SADC", exchangeRate: 0.012, fees: { fixedFee: 1000, percentageFee: 1.0, currency: "NGN" }, complianceChecks: ["AML_SCREENING", "SANCTIONS_CHECK", "CBN_CROSS_BORDER_APPROVAL", "SARB_INBOUND_CHECK", "FATF_TRAVEL_RULE"], avgTransferTimeMs: 15000, dailyVolume: 180, dailyValue: 12000000000, status: "piloting", regulatoryApproval: "CBN/FX/XBORDER/2024-003" },
  { id: "CORR-004", name: "Nigeria → UK (NGN/GBP)", sourceFsp: "54BANK", sourceCountry: "Nigeria", sourceCurrency: "NGN", destFsp: "ECOBANK-UK", destCountry: "United Kingdom", destCurrency: "GBP", region: "PAN_AFRICAN", exchangeRate: 0.00052, fees: { fixedFee: 1500, percentageFee: 1.25, currency: "NGN" }, complianceChecks: ["AML_SCREENING", "SANCTIONS_CHECK", "CBN_CROSS_BORDER_APPROVAL", "FCA_CHECK", "FATF_TRAVEL_RULE", "UK_EDD"], avgTransferTimeMs: 25000, dailyVolume: 850, dailyValue: 65000000000, status: "active", regulatoryApproval: "CBN/FX/XBORDER/2024-004" },
  { id: "CORR-005", name: "Ghana → Nigeria (GHS/NGN)", sourceFsp: "ECOBANK-GH", sourceCountry: "Ghana", sourceCurrency: "GHS", destFsp: "54BANK", destCountry: "Nigeria", destCurrency: "NGN", region: "ECOWAS", exchangeRate: 131.5, fees: { fixedFee: 5, percentageFee: 0.5, currency: "GHS" }, complianceChecks: ["AML_SCREENING", "SANCTIONS_CHECK", "BOG_OUTBOUND_CHECK", "CBN_INBOUND_APPROVAL"], avgTransferTimeMs: 9000, dailyVolume: 980, dailyValue: 8500000, status: "active", regulatoryApproval: "BOG/FX/XBORDER/2024-001" },
  { id: "CORR-006", name: "Kenya → Nigeria (KES/NGN)", sourceFsp: "STANBIC-KE", sourceCountry: "Kenya", sourceCurrency: "KES", destFsp: "54BANK", destCountry: "Nigeria", destCurrency: "NGN", region: "PAN_AFRICAN", exchangeRate: 11.49, fees: { fixedFee: 100, percentageFee: 0.75, currency: "KES" }, complianceChecks: ["AML_SCREENING", "SANCTIONS_CHECK", "CBK_OUTBOUND_CHECK", "CBN_INBOUND_APPROVAL"], avgTransferTimeMs: 13000, dailyVolume: 320, dailyValue: 2500000, status: "active", regulatoryApproval: "CBK/FX/XBORDER/2024-001" },
  { id: "CORR-007", name: "WAEMU Hub (XOF)", sourceFsp: "54BANK", sourceCountry: "Nigeria", sourceCurrency: "NGN", destFsp: "BCEAO-HUB", destCountry: "WAEMU Zone", destCurrency: "XOF", region: "WAEMU", exchangeRate: 0.39, fees: { fixedFee: 600, percentageFee: 0.6, currency: "NGN" }, complianceChecks: ["AML_SCREENING", "SANCTIONS_CHECK", "CBN_CROSS_BORDER_APPROVAL", "BCEAO_APPROVAL"], avgTransferTimeMs: 18000, dailyVolume: 200, dailyValue: 5000000000, status: "piloting", regulatoryApproval: "CBN/FX/XBORDER/2024-005" },
];

// ── 6. TigerBeetle Bridging ──

interface TBBridgeEntry {
  id: string;
  mojaloopTransferId: string;
  tigerbeetleTransferId: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  ledger: number;
  direction: "inbound" | "outbound" | "settlement";
  status: "posted" | "pending" | "voided" | "failed";
  createdAt: string;
  postedAt: string | null;
  latencyMs: number;
}

interface TBBridgeConfig {
  id: string;
  name: string;
  transferType: string;
  debitAccountPattern: string;
  creditAccountPattern: string;
  ledger: number;
  autoPost: boolean;
  requireReconciliation: boolean;
  description: string;
}

const tbBridgeEntries: TBBridgeEntry[] = [
  { id: "TBB-001", mojaloopTransferId: "TXN-MOJA-54BANK-001", tigerbeetleTransferId: "TB-TXN-88901", debitAccount: "TB:54BANK:POSITION", creditAccount: "TB:GTBANK:POSITION", amount: 5000000, currency: "NGN", ledger: 4, direction: "outbound", status: "posted", createdAt: new Date(Date.now() - 60000).toISOString(), postedAt: new Date(Date.now() - 59000).toISOString(), latencyMs: 3 },
  { id: "TBB-002", mojaloopTransferId: "TXN-MOJA-54BANK-003", tigerbeetleTransferId: "TB-TXN-88902", debitAccount: "TB:ACCESSBANK:POSITION", creditAccount: "TB:54BANK:POSITION", amount: 25000000, currency: "NGN", ledger: 4, direction: "inbound", status: "pending", createdAt: new Date(Date.now() - 5000).toISOString(), postedAt: null, latencyMs: 0 },
  { id: "TBB-003", mojaloopTransferId: "TXN-MOJA-XBORDER-001", tigerbeetleTransferId: "TB-TXN-88903", debitAccount: "TB:54BANK:NOSTRO-USD", creditAccount: "TB:ECOBANK-GH:NOSTRO-USD", amount: 100000, currency: "USD", ledger: 5, direction: "outbound", status: "posted", createdAt: new Date(Date.now() - 120000).toISOString(), postedAt: new Date(Date.now() - 118000).toISOString(), latencyMs: 4 },
  { id: "TBB-004", mojaloopTransferId: "SW-001-NET", tigerbeetleTransferId: "TB-TXN-88904", debitAccount: "TB:GTBANK:SETTLEMENT", creditAccount: "TB:54BANK:SETTLEMENT", amount: 125000000000, currency: "NGN", ledger: 4, direction: "settlement", status: "posted", createdAt: new Date(Date.now() - 86400000).toISOString(), postedAt: new Date(Date.now() - 86399000).toISOString(), latencyMs: 2 },
  { id: "TBB-005", mojaloopTransferId: "TXN-MOJA-54BANK-005", tigerbeetleTransferId: "TB-TXN-88905", debitAccount: "TB:54BANK:POSITION", creditAccount: "TB:ZENITHBANK:POSITION", amount: 15000000, currency: "NGN", ledger: 4, direction: "outbound", status: "posted", createdAt: new Date(Date.now() - 30000).toISOString(), postedAt: new Date(Date.now() - 29997).toISOString(), latencyMs: 3 },
];

const tbBridgeConfigs: TBBridgeConfig[] = [
  { id: "TBC-001", name: "Domestic Transfer Bridge", transferType: "domestic_nip", debitAccountPattern: "TB:{payerFsp}:POSITION", creditAccountPattern: "TB:{payeeFsp}:POSITION", ledger: 4, autoPost: true, requireReconciliation: true, description: "Every committed domestic Mojaloop transfer auto-posts to TigerBeetle position accounts" },
  { id: "TBC-002", name: "Cross-Border Transfer Bridge", transferType: "cross_border", debitAccountPattern: "TB:{payerFsp}:NOSTRO-{currency}", creditAccountPattern: "TB:{payeeFsp}:NOSTRO-{currency}", ledger: 5, autoPost: true, requireReconciliation: true, description: "Cross-border transfers post to nostro/vostro accounts in TigerBeetle" },
  { id: "TBC-003", name: "Settlement Net Position Bridge", transferType: "settlement_net", debitAccountPattern: "TB:{netPayer}:SETTLEMENT", creditAccountPattern: "TB:{netPayee}:SETTLEMENT", ledger: 4, autoPost: false, requireReconciliation: true, description: "Settlement window net positions posted after window close and CBN confirmation" },
  { id: "TBC-004", name: "Fee Collection Bridge", transferType: "fee_collection", debitAccountPattern: "TB:{fsp}:POSITION", creditAccountPattern: "TB:MOJALOOP-HUB:FEE-INCOME", ledger: 4, autoPost: true, requireReconciliation: false, description: "Mojaloop switch fees auto-deducted from FSP position and credited to hub fee account" },
];

// ── Express Registration ──

export function registerMojaloopDeepIntegration(app: any) {
  // FSPIOP Callbacks
  app.get("/api/platform/mojaloop/callbacks", (_req: any, res: any) => {
    res.json({ items: fspiopCallbacks, total: fspiopCallbacks.length });
  });
  app.get("/api/platform/mojaloop/callback-endpoints", (_req: any, res: any) => {
    res.json({ items: callbackEndpoints, total: callbackEndpoints.length });
  });

  // ILP Packets
  app.get("/api/platform/mojaloop/ilp-packets", (_req: any, res: any) => {
    res.json({ items: ilpPackets, total: ilpPackets.length });
  });

  // Settlement Windows
  app.get("/api/platform/mojaloop/settlement-windows", (_req: any, res: any) => {
    res.json({ items: settlementWindows, total: settlementWindows.length });
  });
  app.get("/api/platform/mojaloop/settlement-models", (_req: any, res: any) => {
    res.json({ items: settlementModels, total: settlementModels.length });
  });

  // Admin — Participants
  app.get("/api/platform/mojaloop/admin/participants", (_req: any, res: any) => {
    res.json({ items: participants, total: participants.length });
  });
  app.get("/api/platform/mojaloop/admin/limits", (_req: any, res: any) => {
    res.json({ items: participantLimits, total: participantLimits.length });
  });

  // Cross-Border Corridors
  app.get("/api/platform/mojaloop/corridors", (_req: any, res: any) => {
    res.json({ items: corridors, total: corridors.length });
  });
  app.get("/api/platform/mojaloop/corridors/stats", (_req: any, res: any) => {
    const totalDailyVolume = corridors.reduce((s, c) => s + c.dailyVolume, 0);
    const totalDailyValue = corridors.reduce((s, c) => s + c.dailyValue, 0);
    const regions = Array.from(new Set(corridors.map(c => c.region)));
    res.json({ totalCorridors: corridors.length, active: corridors.filter(c => c.status === "active").length, piloting: corridors.filter(c => c.status === "piloting").length, totalDailyVolume, totalDailyValue, regions });
  });

  // TigerBeetle Bridge
  app.get("/api/platform/mojaloop/tb-bridge/entries", (_req: any, res: any) => {
    res.json({ items: tbBridgeEntries, total: tbBridgeEntries.length });
  });
  app.get("/api/platform/mojaloop/tb-bridge/configs", (_req: any, res: any) => {
    res.json({ items: tbBridgeConfigs, total: tbBridgeConfigs.length });
  });
  app.get("/api/platform/mojaloop/tb-bridge/stats", (_req: any, res: any) => {
    const posted = tbBridgeEntries.filter(e => e.status === "posted");
    const avgLatency = posted.reduce((s, e) => s + e.latencyMs, 0) / Math.max(posted.length, 1);
    res.json({ totalEntries: tbBridgeEntries.length, posted: posted.length, pending: tbBridgeEntries.filter(e => e.status === "pending").length, avgPostLatencyMs: Math.round(avgLatency * 10) / 10, bridgeConfigs: tbBridgeConfigs.length });
  });
}
