/**
 * Global API Registry — Tenant Admin Dashboard
 *
 * SINGLE SOURCE OF TRUTH for all APISIX route bindings.
 * Every UI route is mapped here to its APISIX prefix, backend service, and port.
 * Derived exclusively from infrastructure/apisix-resources/routes/*.yaml.
 *
 * Pattern: Frontend → BACKEND_URL + APISIX_PREFIX + /endpoint
 * APISIX strips the prefix before forwarding to the backend service.
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  NEVER invent endpoints. Only prefixes validated against APISIX route YAMLs ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ─── APISIX Prefix Constants ──────────────────────────────────────────────────
// Grouped by domain section matching the sidebar layout.

// § Overview / Dashboard
export const APISIX = {

  // ── Operations ────────────────────────────────────────────────────────────
  ACCOUNT:              "/account",               // account-service :80
  TELLER:               "/teller",                // teller-service :80
  TELLER_OPERATIONS:    "/teller",                // merged → teller-service :80
  BRANCH_OPERATIONS:    "/branch-manager",        // merged → branch-manager-service :80
  BRANCH_MANAGER:       "/branch-manager",        // branch-manager-service :80
  ATM:                  "/account",               // no dedicated APISIX route — routed via account-service
  CARD:                 "/card",                  // card-service :80
  CARD_MANAGEMENT:      "/card",                  // merged → card-service :80
  POS:                  "/pos",                   // pos-terminal-go :8901
  FRAUD_DETECTION:      "/fraud-detection",       // fraud-service :8000 (APISIX rule-2 rewrites /v1/* → /api/v1/fraud/*)

  // ── Payments Hub ──────────────────────────────────────────────────────────
  PAYMENT_HUB:          "/payment-hub",           // payment-hub :80
  PAYMENT_PROCESSING:   "/payment-processing",     // payment-processing-service :9169
  BULK_PAYMENTS:        "/bulk-payments",          // bulk-payments-rs :8130
  QR_PAYMENTS:          "/qr-payments",            // qr-payments-go :8500
  OFFLINE_RESILIENCE:   "/offline-resilience",     // offline-resilience-rs :8229
  UTILITY_PAYMENTS:     "/payment-hub",            // merged → payment-hub :80
  PAYMENT_INVESTIGATION:"/payment-investigation",  // payment-investigation-go :9404
  WIRE_TRANSFER:        "/wire-transfer-monitor",  // wire-transfer-monitor-rs :9325
  NIBSS_DIRECT_DEBIT:   "/nibss-direct-debit",     // nibss-direct-debit-go :8281
  NIBSS_NIP:            "/nibss-nip-engine",       // nibss-nip-engine-go :8111 (operations)
  ISO20022:             "/iso20022",               // iso20022-hub-rs :8901
  SWIFT:                "/swift",                  // swift-messaging-go :8248
  SWIFT_ISO20022:       "/iso20022",               // merged → iso20022-hub-rs :8901
  REMITTANCE:           "/remittance",             // remittance-go :8080
  WHATSAPP_PAYMENT:     "/whatsapp-payment-integration", // whatsapp-payment-integration :9030

  // ── Accounts ──────────────────────────────────────────────────────────────
  ACCOUNT_OPENING:      "/account",               // merged → account-service :80
  ACCOUNT_CLOSURE:      "/account",               // merged → account-service :80
  ACCOUNT_STATEMENTS:   "/account",               // merged → account-service :80
  STATEMENT_GENERATOR:  "/account",               // merged → account-service :80
  BENEFICIARIES:        "/beneficiaries",         // beneficiary-management-go :8116
  DORMANCY:             "/dormancy",              // dormancy-management-rs :8335
  STANDING_ORDERS:      "/standing-orders",       // standing-orders-go :8115
  MANDATE_MANAGEMENT:   "/mandates",              // mandate-management-go :8221
  SAFE_DEPOSIT:         "/safe-deposit",           // safe-deposit-go :9305
  CIF:                  "/cif",                   // cif-management-go :8222

  // ── Products & Services ────────────────────────────────────────────────────
  LOAN:                 "/loan",                  // loan-service :80
  LOAN_CALCULATOR:      "/loan",                  // merged → loan-service :80
  LOAN_ORIGINATION:     "/loan",                  // merged → loan-service :80
  SAVINGS:              "/savings",               // savings-service :80
  SAVINGS_PRODUCTS:     "/savings",               // merged → savings-service :80
  INSURANCE:            "/insurance",             // insurance-service :80
  INSURANCE_ANALYTICS:  "/insurance",             // merged → insurance-service :80
  MORTGAGE:             "/mortgage",              // mortgage-service :80
  MORTGAGE_SERVICING:   "/mortgage",              // merged → mortgage-service :80
  EDUCATION_LOAN:       "/education-loan",        // education-loan-service :80
  EDUCATION_LOANS:      "/education-loan",        // merged → education-loan-service :80
  AGRICULTURE:          "/agriculture",           // agricultural-service :8015
  ISLAMIC_BANKING:      "/islamic-banking",       // islamic-banking-service :80
  ESUSU:                "/esusu",                 // esusu-service :80
  ESUSU_GROUPS:         "/esusu",                 // merged → esusu-service :80
  ESCROW:               "/escrow",                // escrow-service :80
  LPO:                  "/lpo",                   // lpo-service :80
  GROUP_LENDING:        "/group-lending",         // group-lending-go :9273
  AGENT_BANKING:        "/agriculture",           // no dedicated APISIX route — via agricultural-service
  PENSION:              "/pension",               // pension-py :8195
  OPEN_BANKING:         "/open-banking",          // open-banking-go :8200
  OPEN_BANKING_BAAS:    "/open-banking",          // merged → open-banking-go :8200
  PRODUCT_FACTORY:      "/products",              // product-factory-rs :8233

  // ── Credit & Risk ─────────────────────────────────────────────────────────
  RISK_SCORING:         "/risk-manager",          // renamed → risk-manager-service :80
  CREDIT_BUREAU:        "/loan",                  // merged → loan-service :80
  CREDIT_FACILITY:      "/loan",                  // merged → loan-service :80
  CREDIT_SCORING:       "/loan",                  // merged → loan-service :80
  SYNDICATED_LOANS:     "/syndicated-loans",      // syndicated-loans-go :8171
  NIRSAL_GUARANTEE:     "/loan",                  // merged → loan-service :80
  COLLATERAL:           "/collateral",            // collateral-valuation-rs :8154
  DEBT_COLLECTION:      "/debt-collection",       // debt-collection-go :8333
  RISK_BASED_APPROACH:  "/risk-manager",          // merged → risk-manager-service :80
  CONTINGENT_LIAB:      "/contingent-liabilities",// contingent-liabilities-rs :8174
  COOPERATIVE_CREDIT:   "/omini",                 // merged → omini-service :80
  LEASING:              "/leasing",               // leasing-go :8000
  EQUIPMENT_LEASING:    "/leasing",               // merged → leasing-go :8000
  PROJECT_FINANCE:      "/project-finance",       // project-finance-go :8172

  // ── Treasury & FX ─────────────────────────────────────────────────────────
  TREASURY:             "/treasury",              // treasury-service :80
  TREASURY_LIQUIDITY:   "/treasury",              // merged → treasury-service :80
  FX:                   "/fx",                    // fx-service :8080
  FX_RATES:             "/fx",                    // merged → fx-service :8080
  MULTICURRENCY:        "/multicurrency",         // multicurrency-revaluation-rs :8211
  MONEY_MARKET:         "/money-market",          // money-market-rs :8156
  INTERBANK:            "/interbank",             // interbank-lending-rs :8166
  CASH_POOLING:         "/cash-pooling",          // cash-pooling-go :8080
  LCR_NSFR:             "/lcr-nsfr",              // lcr-nsfr-rs :8217
  OTC_DERIVATIVES:      "/otc",                   // otc-derivatives-rs :8161
  SECURITIES:           "/securities",            // securities-trading-rs :8254
  ETD_TRADING:          "/etd",                   // etd-trading-rs :8175

  // ── Trade Finance ─────────────────────────────────────────────────────────
  TRADE_FINANCE:        "/trade-finance",         // trade-finance-service :8080
  BANK_GUARANTEES:      "/trade-finance",         // merged → trade-finance-service :8080
  FACTORING:            "/factoring",             // factoring-go :8080
  SUPPLY_CHAIN_FINANCE: "/supply-chain",          // renamed → supply-chain-service :80
  DIASPORA_BANKING:     "/diaspora",              // diaspora-banking-py :8135
  WEALTH_MGMT:          "/wealth",                // wealth-mgmt-py :8168
  PORTFOLIO_MGMT:       "/portfolio",             // portfolio-mgmt-rs :8167
  CUSTODY_SERVICE:      "/custody",               // custody-service-go :9251
  TRUST_ESTATE:         "/trust-estate",          // trust-estate-rs :8185

  // ── AML & Fraud ───────────────────────────────────────────────────────────
  AI_FRAUD_SCORING:     "/fraud-detection",       // merged → fraud-service :8000
  AML_COMPLIANCE_DASH:  "/compliance",            // merged → compliance-service :80
  AML_CASE_MANAGER:     "/compliance",            // merged → compliance-service :80
  AML_ENGINE:           "/compliance",            // merged → compliance-service :80
  AML_RISK_SCORING:     "/compliance",            // merged → compliance-service: /api/v1/compliance/aml/*
  AML_TRAINING:         "/compliance",            // merged → compliance-service :80
  FRAUD:                "/fraud-detection",       // fraud-service :8000
  FRAUDFUSION:          "/fraudfusion",           // renamed → fraudfusion :8303
  GNN_FRAUD:            "/fraud-detection",       // merged → fraud-service :8000
  ANOMALY_DETECTOR:     "/fraud-detection",       // merged → fraud-service :8000
  TXN_MONITORING:       "/txn-monitoring-rules",  // txn-monitoring-rules-rs :8285
  TXN_PATTERN:          "/compliance",            // merged → compliance-service :80
  TYPOLOGY_DETECTOR:    "/compliance",            // merged → compliance-service :80
  CTR_AUTO_FILER:       "/ctr",                   // merged → nfiu-ctr-str-filing-py :8283
  SAR_FILING:           "/sar-filing-engine",     // sar-filing-engine-go :9159
  NFIU_CTR_STR:         "/ctr",                   // nfiu-ctr-str-filing-py :8283
  GOAML:                "/compliance",            // merged → compliance-service :80
  NDPR_COMPLIANCE:      "/ndpr-compliance",       // ndpr-compliance-py :9300
  COMPLIANCE:           "/compliance",            // compliance-service :80
  CBN_COMPLIANCE:       "/cbn",                   // merged → cbn-service :80

  // ── Watchlists & Sanctions ─────────────────────────────────────────────────
  SANCTIONS:            "/sanctions",             // sanctions-screening-service :80
  SANCTIONS_ENGINE:     "/sanctions",             // merged → sanctions-screening-service :80
  SANCTIONS_RESCREENER: "/sanctions",             // merged → sanctions-screening-service :80
  ADVERSE_MEDIA:        "/compliance",            // merged → compliance-service :80
  ADVERSE_MEDIA_SCANNER:"/compliance",            // merged → compliance-service :80
  WATCHLIST_MANAGER:    "/watchlist-manager",     // watchlist-manager-rs :9322
  BENEFICIAL_OWNERSHIP: "/ubo",                   // merged → ubo-service :80
  UBO:                  "/ubo",                   // ubo-service :80
  CORPORATE_MONITORING: "/compliance",            // merged → compliance-service :80

  // ── Regulatory Compliance ──────────────────────────────────────────────────
  REGULATORY_REPORTING: "/regulatory-reporting",  // regulatory-reporting-go :9072
  CBN_RETURNS:          "/cbn",                   // merged → cbn-service :80
  EFASS_KYC_RETURNS:    "/cbn",                   // merged → cbn-service :80
  EFASS_GENERATOR:      "/cbn",                   // merged → cbn-service :80
  TAX_REPORTING:        "/tax",                   // tax-reporting-py :8338
  IFRS9:                "/ifrs9",                 // ifrs9-engine-rs :8164
  IFRS9_ECL:            "/ifrs9",                 // merged → ifrs9-engine-rs :8164
  FATCA_CRS:            "/fatca-crs",             // fatca-crs-rs :8188
  BASEL_ENGINE:         "/basel-engine",          // basel-engine-rs :9218
  KPI_ENGINE:           "/kpi-engine-go",         // renamed → kpi-engine-go :8500
  KPI_ANALYTICS:        "/kpi-engine-go",         // merged → kpi-engine-go :8500

  // ── Finance & Accounting (see financeApi.ts for typed API functions) ───────
  TENANT_BILLING:       "/finance",               // merged → finance-service :80
  CHART_OF_ACCOUNTS:    "/chart-of-accounts",     // chart-of-accounts-service :80
  GL_ENGINE:            "/gl-engine",             // gl-engine-go :8090
  FEE_MANAGEMENT:       "/fee-management",        // fee-management-go :9268
  INTEREST_ACCRUAL:     "/interest-accrual-engine",// interest-accrual-engine-go :8093
  INTEREST_RATE:        "/interest-accrual-engine",// merged → interest-accrual-engine-go :8093
  INTEREST_COMPUTATION: "/interest-accrual-engine",// merged → interest-accrual-engine-go :8093
  FIXED_ASSETS:         "/fixed-assets",          // fixed-assets-go :8080
  EXPENSES:             "/expenses",              // expense-mgmt-go :8080
  ACCOUNTING_RULES:     "/chart-of-accounts",     // merged → chart-of-accounts-service :80
  ERP:                  "/erp",                   // erpnext-integration-service :80
  ERPNEXT_BRIDGE:       "/erp",                   // merged → erpnext-integration-service :80
  STANDING_CHARGES:     "/standing-charges",      // standing-charges-go :8197

  // ── Settlement & Clearing ──────────────────────────────────────────────────
  CHEQUE_CLEARING:      "/cheque-clearing",       // cheque-clearing-go :9240
  BANKING_CLEARING_OPS: "/settlement",             // mojaloop-settlement-mgr-go :9394
  EOD_PROCESSOR:        "/eod",                   // eod-processor-go :8207
  BATCH_AGGREGATOR:     "/eod",                   // merged → eod-processor-go :8207
  BATCH_PROCESSING:     "/eod",                   // merged → eod-processor-go :8207
  MOJALOOP_SETTLEMENT:  "/settlement",             // mojaloop-settlement-mgr-go :9394
  LEDGER_RECONCILIATION:"/ledger-reconciliation", // ledger-reconciliation-rs :8100

  // ── Cooperative & Groups ───────────────────────────────────────────────────
  COOPERATIVE_MGMT:     "/omini",                 // merged → omini-service :80
  COOPERATIVE_FINANCIALS:"/omini",                // merged → omini-service :80
  COOPERATIVE_MEETINGS: "/omini",                 // merged → omini-service :80

  // ── Agriculture (dedicated APISIX routes derived from apisix-resources/routes/) ─
  AGENT_FARMER_ONBOARDING:    "/agriculture",               // merged → agricultural-service :8015
  CROP_YIELD_PREDICTION:      "/crop-yield-prediction",     // crop-yield-prediction-py :9129
  FARM_BOUNDARY_MAPPING:      "/farm-boundary-mapping",     // farm-boundary-mapping-rs :9579
  SATELLITE_CROP_MONITOR:     "/satellite-crop-monitor",    // satellite-crop-monitor-rs :9589
  SOIL_ANALYSIS:              "/agriculture",               // merged → agricultural-service :8015
  LIVESTOCK_FINANCE:          "/agriculture",               // merged → agricultural-service :8015
  LIVESTOCK_MGMT:             "/agriculture",               // merged → agricultural-service :8015
  LIVESTOCK_INSURANCE:        "/agriculture",               // merged → agricultural-service :8015
  COMMODITY_EXCHANGE:         "/commodity-exchange",        // commodity-exchange-rs :9214
  COMMODITY_PRICE_INTEL:      "/commodity-price-intelligence", // commodity-price-intelligence-py :9643
  WAREHOUSE_MGMT:             "/warehouse-management",      // warehouse-management-go :9079
  AGRI_IOT_SENSOR:            "/agri-iot-sensor",           // agri-iot-sensor-rs :9567
  AGRI_EVOUCHER:              "/agri-evoucher",             // agri-evoucher-go :9565
  AGRI_LOGISTICS:             "/agri-logistics",            // agri-logistics-go :9568
  AGRI_SAVINGS_CYCLES:        "/agri-savings-cycles",       // agri-savings-cycles-go :9301
  AGRI_REINSURANCE:           "/agri-reinsurance",          // agri-reinsurance-go :9569
  CBN_AGRI_RETURNS:           "/cbn-agri-returns",          // cbn-agri-returns-py :9247
  CBN_AGSMEIS:                "/cbn",                       // merged → cbn-service :80
  CBN_ANCHOR_BORROWERS:       "/cbn",                       // merged → cbn-service :80
  NIRSAL_AGRO_GEOCOOP:        "/agriculture",               // merged → agricultural-service :8015
  ACGSF_GUARANTEE:            "/agriculture",               // merged → agricultural-service :8015
  FISHERIES_AQUACULTURE:      "/fisheries-aquaculture",     // fisheries-aquaculture-go :9580
  CROSSBORDER_AGRI_TRADE:     "/crossborder-agri-trade",    // crossborder-agri-trade-rs :9576
  AREA_YIELD_INDEX_INSURANCE: "/area-yield-index-insurance",// area-yield-index-insurance-py :9602
  AGRICULTURE_BANKING_RS:     "/agriculture-banking",       // agriculture-banking-rs :9571
  AGRI_INPUT_MARKETPLACE:     "/agri-input-marketplace",    // agri-input-marketplace-go :9566
  AGRI_ESG_IMPACT:            "/agri-esg-impact",           // agri-esg-impact-py :9564

  // ── Customers ─────────────────────────────────────────────────────────────
  USER:                 "/user",                  // user-service :80
  KYB:                  "/kyb-service",           // renamed → kyb-service :80
  KYB_ENGINE:           "/kyb-service",           // merged → kyb-service :80
  BUSINESS_VERIFICATION:"/kyb-service",           // merged → kyb-service :80
  COMMUNICATION_HUB:    "/communication-hub",     // communication-hub :80
  SALARY_PROCESSING:    "/salary",                // salary-processing-go :8150
  RELATIONSHIP_MANAGER: "/rm",                    // relationship-manager-service :80
  RELATIONSHIP_PRICING: "/rm",                    // merged → relationship-manager-service :80

  // ── Digital Channels ──────────────────────────────────────────────────────
  USSD_BANKING_GW:      "/ussd-gateway-service",  // renamed → ussd-gateway-service :80
  USSD:                 "/ussd-service",           // renamed → ussd-service :80
  USSD_MULTILINGUAL:    "/ussd-service",           // merged → ussd-service :80
  USSD_SIM_TOOLKIT:     "/ussd-service",           // merged → ussd-service :80
  USSD_TXN_ENGINE:      "/ussd-service",           // merged → ussd-service :80
  WHATSAPP_BANKING:     "/whatsapp-service",       // merged → whatsapp-service :80
  WHATSAPP_GATEWAY:     "/whatsapp-service",       // merged → whatsapp-service :80
  WHATSAPP:             "/whatsapp-service",       // renamed → whatsapp-service :80
  SMS_BANKING:          "/sms-service",            // renamed → sms-service :80
  SMS_BANKING_GW:       "/sms-service",            // merged → sms-service :80
  TELEGRAM_BOT_GW:      "/telegram-service",       // merged → telegram-service :80
  TELEGRAM_COMMANDS:    "/telegram-service",       // merged → telegram-service :80
  TELEGRAM:             "/telegram-service",       // renamed → telegram-service :80
  VOICE_BANKING_GW:     "/voice-banking-gateway",  // voice-banking-gateway-go :9048
  CHATBOT:              "/chatbot",                // chatbot-service :9239
  IDENTITY_CHANNELS:    "/identity-verification",  // merged → identity-verification-service :80

  // ── Notifications ─────────────────────────────────────────────────────────
  NOTIFICATION:         "/notification",          // notification-service-go :9302
  NOTIFICATION_ROUTER:  "/notification",          // merged → notification-service-go :9302
  WEBHOOKS:             "/webhooks",              // webhook-engine-go :8238
  SMS_ALERT_NOTIFICATION:"/sms-notification",     // renamed → sms-notification-service :80
  SMS_EMAIL_GW:         "/sms-service",           // merged → sms-service :80

  // ── Workflow & Documents ───────────────────────────────────────────────────
  APPROVAL_WORKFLOW:    "/approvals",             // merged → maker-checker-go :8210
  WORKFLOW_ENGINE:      "/workflows",             // workflow-engine-py :8123
  MAKER_CHECKER:        "/approvals",             // maker-checker-go :8210
  DOCUMENT_MANAGEMENT:  "/document",              // merged → document-service :80
  DOCUMENT:             "/document",              // document-service :80

  // ── Compliance & Audit ─────────────────────────────────────────────────────
  DISPUTE:              "/dispute",               // dispute-service :80
  DISPUTE_MANAGEMENT:   "/dispute",               // merged → dispute-service :80
  AUDIT:                "/audit",                 // audit-service :80
  TEMPORAL_ACCESS:      "/temporal-access",       // temporal-access-service :80
  AUTH_ENFORCER:        "/permify-authz",         // renamed → permify-authz-go :8314

  // ── Monitoring & Administration ────────────────────────────────────────────
  OPS_DASHBOARD:        "/ops-dashboard",         // ops-dashboard :8090
  ANALYTICS_ENGINE:     "/reporting",             // merged → reporting-service :80
  API_ANALYTICS:        "/api-analytics",         // api-analytics-py :9210
  KPI_THRESHOLD:        "/kpi-engine-go",         // merged → kpi-engine-go :8500
  ADMIN:                "/admin",                 // admin-service :80
  TENANT_MGMT:          "/tenant-management",     // tenant-management :80
  TENANT_PROVISIONING:  "/tenant-management",     // merged → tenant-management :80

  // ── KYC & Identity ─────────────────────────────────────────────────────────
  KYC:                  "/compliance",            // no dedicated APISIX route — via compliance-service :80
  KYC_ANALYTICS:        "/compliance",            // merged → compliance-service :80
  KYC_DATA_QUALITY:     "/compliance",            // merged → compliance-service :80
  KYC_SELF_SERVICE:     "/compliance",            // merged → compliance-service :80
  KYC_WORKFLOW:         "/compliance",            // merged → compliance-service :80
  KYC_AML:              "/compliance",            // merged → compliance-service :80
  BVN_NIN:              "/bvn-nin",               // bvn-nin-verification-go :8281
  CAC_REALTIME:         "/cac-realtime-api",       // cac-realtime-api-go :9232
  ADDRESS_VERIFICATION: "/identity-verification", // merged → identity-verification-service :80
  CORPORATE_DOC_VERIFY: "/identity-verification", // merged → identity-verification-service :80
  BIOMETRIC_AUTH:       "/biometric",             // renamed → biometric-service :80
  FACE_MATCH:           "/biometric",             // merged → biometric-service :80
  LIVENESS_DETECTION:   "/biometric",             // merged → biometric-service :80
  CONTINUOUS_LIVENESS:  "/biometric",             // merged → biometric-service :80
  VIDEO_KYC:            "/video-kyc",             // video-kyc-py :8080
  AGENT_KYC_CAPTURE:    "/biometric",             // merged → biometric-service :80
  MULTI_BUREAU:         "/bvn-nin",               // merged → bvn-nin-verification-go :8281
  CBN_TIERED_KYC:       "/cbn",                   // merged → cbn-service :80
  IDENTITY_VERIFICATION:"/identity-verification", // identity-verification-service :80

} as const;

export type ApisixPrefix = typeof APISIX[keyof typeof APISIX];

// ─── Route Registry ───────────────────────────────────────────────────────────
// Maps every Sidebar UI route to its APISIX prefix, backend service name,
// feature flag, and permission key. This is the authoritative lookup for
// the UI-API binding enforcement layer.
export interface RouteRegistryEntry {
  /** UI path from the router */
  uiPath: string;
  /** Sidebar label */
  label: string;
  /** APISIX gateway prefix (strips to / before backend) */
  apisixPrefix: ApisixPrefix;
  /** Backend service name (Kubernetes service) */
  backendService: string;
  /** Backend service port */
  port: number;
  /** Sidebar section */
  section: string;
  /** Feature flag key */
  featureFlag?: string;
  /** Permission key */
  permission?: string;
}

export const ROUTE_REGISTRY: RouteRegistryEntry[] = [
  // ── Operations ────────────────────────────────────────────────────────────
  { uiPath: "/transactions",           label: "Transactions",       apisixPrefix: APISIX.ACCOUNT,          backendService: "account-service",           port: 80,   section: "Operations",     featureFlag: "transactions",    permission: "VIEW_ALL_DATA" },
  { uiPath: "/transfer",               label: "Transfer",           apisixPrefix: APISIX.PAYMENT_PROCESSING, backendService: "payment-processing-service", port: 80,  section: "Operations",     featureFlag: "payments",        permission: "INITIATE_TRANSACTIONS" },
  { uiPath: "/teller-operations",      label: "Teller Station",     apisixPrefix: APISIX.TELLER_OPERATIONS, backendService: "teller-operations-go",      port: 8080, section: "Operations",     featureFlag: "teller",          permission: "TELLER_ACTIONS" },
  { uiPath: "/teller",                 label: "Teller Workspace",   apisixPrefix: APISIX.TELLER,           backendService: "teller-service",             port: 80,   section: "Operations",     featureFlag: "teller",          permission: "TELLER_MANAGEMENT" },
  { uiPath: "/branches",               label: "Branch Operations",  apisixPrefix: APISIX.BRANCH_MANAGER,   backendService: "branch-manager-service",     port: 80,   section: "Operations",     featureFlag: "branches",        permission: "VIEW_BRANCH_DATA" },
  { uiPath: "/branch-performance-map", label: "Branch Performance", apisixPrefix: APISIX.BRANCH_OPERATIONS,backendService: "branch-operations-go",       port: 8250, section: "Operations",     featureFlag: "branches",        permission: "VIEW_BRANCH_DATA" },
  { uiPath: "/atm-management",         label: "ATM Management",     apisixPrefix: APISIX.ATM,              backendService: "atm-management-go",          port: 8147, section: "Operations",     featureFlag: "atm_management",  permission: "CARD_MANAGEMENT" },
  { uiPath: "/card-dashboard",         label: "Card Issuance",      apisixPrefix: APISIX.CARD,             backendService: "card-service",               port: 80,   section: "Operations",     featureFlag: "card_management", permission: "CARD_ISSUANCE" },
  { uiPath: "/admin/cards",            label: "Card Management",    apisixPrefix: APISIX.CARD_MANAGEMENT,  backendService: "card-management-go",         port: 9233, section: "Operations",     featureFlag: "card_management", permission: "CARD_MANAGEMENT" },
  { uiPath: "/card-fraud-rules",       label: "Card Fraud Rules",   apisixPrefix: APISIX.FRAUD_DETECTION,  backendService: "fraud-detection-rs",         port: 9269, section: "Operations",     featureFlag: "card_management", permission: "CARD_MANAGEMENT" },
  { uiPath: "/pos-terminal",           label: "POS Terminals",      apisixPrefix: APISIX.POS,              backendService: "pos-terminal-go",            port: 8901, section: "Operations",     featureFlag: "pos_terminal",    permission: "CARD_MANAGEMENT" },

  // ── Payments Hub ──────────────────────────────────────────────────────────
  { uiPath: "/payments-hub",               label: "Payments Hub",         apisixPrefix: APISIX.PAYMENT_HUB,       backendService: "payment-hub",               port: 80,   section: "Payments Hub", featureFlag: "payments",        permission: "VIEW_ALL_DATA" },
  { uiPath: "/bulk-payments",              label: "Bulk Payments",        apisixPrefix: APISIX.BULK_PAYMENTS,     backendService: "bulk-payments-rs",          port: 9229, section: "Payments Hub", featureFlag: "bulk_payments",   permission: "INITIATE_TRANSACTIONS" },
  { uiPath: "/qr-payments",               label: "QR Payments",          apisixPrefix: APISIX.QR_PAYMENTS,       backendService: "qr-payments-go",            port: 8500, section: "Payments Hub", featureFlag: "qr_payments",     permission: "INITIATE_TRANSACTIONS" },
  { uiPath: "/offline-transactions",      label: "Offline Transactions", apisixPrefix: APISIX.OFFLINE_RESILIENCE, backendService: "offline-resilience-rs",    port: 8253, section: "Payments Hub", featureFlag: "payments",        permission: "INITIATE_TRANSACTIONS" },
  { uiPath: "/utility-payments",          label: "Utility Payments",     apisixPrefix: APISIX.UTILITY_PAYMENTS,  backendService: "utility-payments-go",       port: 8031, section: "Payments Hub", featureFlag: "bill_payments",   permission: "INITIATE_TRANSACTIONS" },
  { uiPath: "/self-service-transactions", label: "Self Service",         apisixPrefix: APISIX.PAYMENT_HUB,       backendService: "payment-hub",               port: 80,   section: "Payments Hub", featureFlag: "payments",        permission: "INITIATE_TRANSACTIONS" },
  { uiPath: "/payment-transactions",      label: "Payment History",      apisixPrefix: APISIX.PAYMENT_PROCESSING, backendService: "payment-processing-service",port: 80,  section: "Payments Hub", featureFlag: "payments",        permission: "VIEW_ALL_DATA" },
  { uiPath: "/payment-investigation",     label: "Payment Investigation",apisixPrefix: APISIX.PAYMENT_INVESTIGATION, backendService: "payment-investigation-go", port: 8080, section: "Payments Hub", featureFlag: "payments",   permission: "VIEW_ALL_DATA" },
  { uiPath: "/wire-transfer-monitor",     label: "Wire Transfer Monitor",apisixPrefix: APISIX.WIRE_TRANSFER,     backendService: "wire-transfer-monitor-rs",  port: 9325, section: "Payments Hub", featureFlag: "payments",        permission: "VIEW_ALL_DATA" },
  { uiPath: "/nibss-direct-debit",        label: "NIBSS Direct Debit",   apisixPrefix: APISIX.NIBSS_DIRECT_DEBIT,backendService: "nibss-direct-debit-go",     port: 8281, section: "Payments Hub", featureFlag: "payments",        permission: "INITIATE_TRANSACTIONS" },
  { uiPath: "/iso20022-hub",              label: "ISO 20022 Hub",        apisixPrefix: APISIX.ISO20022,          backendService: "iso20022-hub-rs",           port: 8901, section: "Payments Hub", featureFlag: "payments",        permission: "VIEW_ALL_DATA" },
  { uiPath: "/swift-messages",            label: "SWIFT Messages",       apisixPrefix: APISIX.SWIFT,             backendService: "swift-messaging-go",        port: 8248, section: "Payments Hub", featureFlag: "payments",        permission: "VIEW_ALL_DATA" },
  { uiPath: "/remittance",                label: "Remittance",           apisixPrefix: APISIX.REMITTANCE,        backendService: "remittance-go",             port: 8080, section: "Payments Hub", featureFlag: "remittance",      permission: "INITIATE_TRANSACTIONS" },
  { uiPath: "/whatsapp-payment-integration", label: "WhatsApp Payments", apisixPrefix: APISIX.WHATSAPP_PAYMENT, backendService: "whatsapp-payment-integration-go", port: 9030, section: "Payments Hub", featureFlag: "whatsapp_banking", permission: "INITIATE_TRANSACTIONS" },

  // ── Accounts ──────────────────────────────────────────────────────────────
  { uiPath: "/account-opening",       label: "Account Opening",      apisixPrefix: APISIX.ACCOUNT_OPENING,   backendService: "account-opening-go",        port: 8114, section: "Accounts", featureFlag: "accounts", permission: "APPLICATIONS" },
  { uiPath: "/account-closure",       label: "Account Closure",      apisixPrefix: APISIX.ACCOUNT_CLOSURE,   backendService: "account-closure-go",        port: 8334, section: "Accounts", featureFlag: "accounts", permission: "APPLICATIONS" },
  { uiPath: "/account-statements",    label: "Account Statements",   apisixPrefix: APISIX.ACCOUNT_STATEMENTS,backendService: "account-statement-go",      port: 8138, section: "Accounts", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/statement-generator",   label: "Statement Generator",  apisixPrefix: APISIX.STATEMENT_GENERATOR,backendService: "statement-generator-py",   port: 8215, section: "Accounts", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/beneficiary-management",label: "Beneficiaries",        apisixPrefix: APISIX.BENEFICIARIES,     backendService: "beneficiary-management-go", port: 8116, section: "Accounts", featureFlag: "accounts", permission: "MANAGE_CUSTOMERS" },
  { uiPath: "/dormancy-management",   label: "Dormancy Management",  apisixPrefix: APISIX.DORMANCY,          backendService: "dormancy-management-rs",    port: 8335, section: "Accounts", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/standing-orders",       label: "Standing Orders",      apisixPrefix: APISIX.STANDING_ORDERS,   backendService: "standing-orders-go",        port: 8115, section: "Accounts", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/mandate-management",    label: "Mandate Management",   apisixPrefix: APISIX.MANDATE_MANAGEMENT,backendService: "mandate-management-go",     port: 8221, section: "Accounts", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/safe-deposit",          label: "Safe Deposit",         apisixPrefix: APISIX.SAFE_DEPOSIT,      backendService: "safe-deposit-go",           port: 8190, section: "Accounts", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/cif-management",        label: "CIF Management",       apisixPrefix: APISIX.CIF,               backendService: "cif-management-go",         port: 8222, section: "Accounts", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },

  // ── Products & Services ────────────────────────────────────────────────────
  { uiPath: "/loans",                         label: "Loans",               apisixPrefix: APISIX.LOAN,                 backendService: "loan-service",                  port: 80,   section: "Products & Services", featureFlag: "loans",              permission: "APPLICATIONS" },
  { uiPath: "/loan-calculator",               label: "Loan Calculator",     apisixPrefix: APISIX.LOAN_CALCULATOR,      backendService: "loan-calculator-go",            port: 8119, section: "Products & Services", featureFlag: "loans",              permission: "APPLICATIONS" },
  { uiPath: "/savings",                       label: "Savings",             apisixPrefix: APISIX.SAVINGS,              backendService: "savings-service",               port: 80,   section: "Products & Services", featureFlag: "savings",            permission: "APPLICATIONS" },
  { uiPath: "/insurance",                     label: "Insurance Portal",    apisixPrefix: APISIX.INSURANCE,            backendService: "insurance-service",             port: 80,   section: "Products & Services", featureFlag: "insurance",          permission: "APPLICATIONS" },
  { uiPath: "/insurance-portfolio-analytics", label: "Insurance Analytics", apisixPrefix: APISIX.INSURANCE_ANALYTICS,  backendService: "insurance-portfolio-analytics-py", port: 9275, section: "Products & Services", featureFlag: "insurance",       permission: "ANALYTICS" },
  { uiPath: "/mortgage-banking",              label: "Mortgage Banking",    apisixPrefix: APISIX.MORTGAGE,             backendService: "mortgage-service",              port: 80,   section: "Products & Services", featureFlag: "mortgage",           permission: "APPLICATIONS" },
  { uiPath: "/education-banking",             label: "Education Banking",   apisixPrefix: APISIX.EDUCATION_LOAN,       backendService: "education-loan-service",        port: 80,   section: "Products & Services", featureFlag: "education_loans",    permission: "APPLICATIONS" },
  { uiPath: "/agriculture-banking",           label: "Agriculture Banking", apisixPrefix: APISIX.AGRICULTURE_BANKING_RS, backendService: "agriculture-banking-rs",         port: 9571, section: "Products & Services", featureFlag: "agriculture_finance",permission: "AGRIC_BANKING" },
  { uiPath: "/islamic-banking",               label: "Islamic Banking",     apisixPrefix: APISIX.ISLAMIC_BANKING,      backendService: "islamic-banking-service",       port: 80,   section: "Products & Services", featureFlag: "islamic_banking",    permission: "ISLAMIC_BANKING" },
  { uiPath: "/esusu-management",              label: "Esusu Portal",        apisixPrefix: APISIX.ESUSU,                backendService: "esusu-service",                 port: 80,   section: "Products & Services", featureFlag: "esusu",              permission: "APPLICATIONS" },
  { uiPath: "/escrow-management",             label: "Escrow Management",   apisixPrefix: APISIX.ESCROW,               backendService: "escrow-service",                port: 80,   section: "Products & Services", featureFlag: "escrow",             permission: "APPLICATIONS" },
  { uiPath: "/lpo",                           label: "LPO",                 apisixPrefix: APISIX.LPO,                  backendService: "lpo-service",                   port: 80,   section: "Products & Services", featureFlag: "lpo",                permission: "APPLICATIONS" },
  { uiPath: "/group-lending",                 label: "Group Lending",       apisixPrefix: APISIX.GROUP_LENDING,        backendService: "group-lending-go",              port: 9273, section: "Products & Services", featureFlag: "loans",              permission: "APPLICATIONS" },
  { uiPath: "/agent-banking",                 label: "Agent Banking",       apisixPrefix: APISIX.AGENT_BANKING,        backendService: "agent-banking-go",              port: 8085, section: "Products & Services", featureFlag: "agent_banking",      permission: "AGRIC_BANKING" },
  { uiPath: "/pension",                       label: "Pension",             apisixPrefix: APISIX.PENSION,              backendService: "pension-py",                    port: 8195, section: "Products & Services", featureFlag: "pension",            permission: "APPLICATIONS" },
  { uiPath: "/open-banking",                  label: "Open Banking",        apisixPrefix: APISIX.OPEN_BANKING,         backendService: "open-banking-go",               port: 8200, section: "Products & Services", featureFlag: "open_banking",       permission: "APPLICATIONS" },

  // ── Credit & Risk ─────────────────────────────────────────────────────────
  { uiPath: "/credit-risk",               label: "Credit Risk",           apisixPrefix: APISIX.RISK_SCORING,       backendService: "risk-scoring-rs",           port: 8145, section: "Credit & Risk", featureFlag: "risk_management",        permission: "VIEW_ALL_DATA" },
  { uiPath: "/credit-bureau",             label: "Credit Bureau",         apisixPrefix: APISIX.CREDIT_BUREAU,      backendService: "credit-bureau-rs",          port: 8151, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/credit-facilities",         label: "Credit Facilities",     apisixPrefix: APISIX.CREDIT_FACILITY,    backendService: "credit-facility-go",        port: 8214, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/credit-scoring",            label: "Credit Scoring",        apisixPrefix: APISIX.CREDIT_SCORING,     backendService: "credit-scoring-py",         port: 9249, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/syndicated-loans",          label: "Syndicated Loans",      apisixPrefix: APISIX.SYNDICATED_LOANS,   backendService: "syndicated-loans-go",       port: 8171, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/nirsal-credit-guarantee",   label: "NIRSAL Guarantee",      apisixPrefix: APISIX.NIRSAL_GUARANTEE,   backendService: "nirsal-credit-guarantee-go",port: 9149, section: "Credit & Risk", featureFlag: "loans",                  permission: "APPLICATIONS" },
  { uiPath: "/collateral",                label: "Collateral",            apisixPrefix: APISIX.COLLATERAL,         backendService: "collateral-valuation-rs",   port: 8154, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/collateral-valuation",      label: "Collateral Valuation",  apisixPrefix: APISIX.COLLATERAL,         backendService: "collateral-valuation-rs",   port: 8154, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/debt-collection",           label: "Debt Collection",       apisixPrefix: APISIX.DEBT_COLLECTION,    backendService: "debt-collection-go",        port: 8333, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/limit-management",          label: "Limit Management",      apisixPrefix: APISIX.CREDIT_FACILITY,    backendService: "credit-facility-go",        port: 8214, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/risk-scoring",              label: "Risk Scoring",          apisixPrefix: APISIX.RISK_SCORING,       backendService: "risk-scoring-rs",           port: 8145, section: "Credit & Risk", featureFlag: "risk_management",        permission: "VIEW_ALL_DATA" },
  { uiPath: "/risk-based-approach",       label: "Risk Based Approach",   apisixPrefix: APISIX.RISK_BASED_APPROACH,backendService: "risk-based-approach-py",    port: 9315, section: "Credit & Risk", featureFlag: "risk_management",        permission: "VIEW_ALL_DATA" },
  { uiPath: "/contingent-liabilities",    label: "Contingent Liabilities",apisixPrefix: APISIX.CONTINGENT_LIAB,   backendService: "contingent-liabilities-rs", port: 8174, section: "Credit & Risk", featureFlag: "loans",                  permission: "VIEW_ALL_DATA" },
  { uiPath: "/cooperative-credit-scoring",label: "Cooperative Credit",    apisixPrefix: APISIX.COOPERATIVE_CREDIT,backendService: "cooperative-credit-scoring-py",port: 9245, section: "Credit & Risk", featureFlag: "cooperative_management", permission: "VIEW_ALL_DATA" },
  { uiPath: "/leasing",                   label: "Leasing",               apisixPrefix: APISIX.LEASING,            backendService: "leasing-go",                port: 8000, section: "Credit & Risk", featureFlag: "leasing",                permission: "APPLICATIONS" },
  { uiPath: "/equipment-leasing",         label: "Equipment Leasing",     apisixPrefix: APISIX.EQUIPMENT_LEASING,  backendService: "equipment-leasing-go",      port: 9054, section: "Credit & Risk", featureFlag: "leasing",                permission: "APPLICATIONS" },
  { uiPath: "/project-finance",           label: "Project Finance",       apisixPrefix: APISIX.PROJECT_FINANCE,    backendService: "project-finance-go",        port: 8172, section: "Credit & Risk", featureFlag: "loans",                  permission: "APPLICATIONS" },

  // ── Treasury & FX ─────────────────────────────────────────────────────────
  { uiPath: "/treasury",           label: "Treasury",          apisixPrefix: APISIX.TREASURY,          backendService: "treasury-service",        port: 80,   section: "Treasury & FX", featureFlag: "treasury", permission: "VIEW_ALL_DATA" },
  { uiPath: "/treasury-liquidity", label: "Liquidity",         apisixPrefix: APISIX.TREASURY_LIQUIDITY,backendService: "treasury-liquidity-rs",   port: 8142, section: "Treasury & FX", featureFlag: "treasury", permission: "VIEW_ALL_DATA" },
  { uiPath: "/fx-dealing-room",    label: "FX Dealing Room",   apisixPrefix: APISIX.FX,                backendService: "fx-service",              port: 8080, section: "Treasury & FX", featureFlag: "fx",       permission: "VIEW_ALL_DATA" },
  { uiPath: "/fx-rates",           label: "FX Rates",          apisixPrefix: APISIX.FX_RATES,          backendService: "fx-rates-engine-rs",      port: 8118, section: "Treasury & FX", featureFlag: "fx",       permission: "VIEW_ALL_DATA" },
  { uiPath: "/fx-positions",       label: "FX Positions",      apisixPrefix: APISIX.FX,                backendService: "fx-service",              port: 8080, section: "Treasury & FX", featureFlag: "fx",       permission: "VIEW_ALL_DATA" },
  { uiPath: "/fx-revaluation",     label: "FX Revaluation",    apisixPrefix: APISIX.MULTICURRENCY,     backendService: "multicurrency-revaluation-rs", port: 8211, section: "Treasury & FX", featureFlag: "fx", permission: "VIEW_ALL_DATA" },
  { uiPath: "/multi-currency-fx",  label: "Multi-Currency FX", apisixPrefix: APISIX.MULTICURRENCY,     backendService: "multicurrency-revaluation-rs", port: 8211, section: "Treasury & FX", featureFlag: "fx", permission: "VIEW_ALL_DATA" },
  { uiPath: "/money-market",       label: "Money Market",      apisixPrefix: APISIX.MONEY_MARKET,      backendService: "money-market-rs",         port: 8156, section: "Treasury & FX", featureFlag: "treasury", permission: "VIEW_ALL_DATA" },
  { uiPath: "/interbank-lending",  label: "Interbank Lending", apisixPrefix: APISIX.INTERBANK,         backendService: "interbank-lending-rs",    port: 8166, section: "Treasury & FX", featureFlag: "treasury", permission: "VIEW_ALL_DATA" },
  { uiPath: "/cash-management",    label: "Cash Management",   apisixPrefix: APISIX.BANKING_CLEARING_OPS, backendService: "banking-clearing-ops-rs", port: 1105, section: "Treasury & FX", featureFlag: "treasury", permission: "VIEW_ALL_DATA" },
  { uiPath: "/cash-pooling",       label: "Cash Pooling",      apisixPrefix: APISIX.CASH_POOLING,      backendService: "cash-pooling-go",         port: 8080, section: "Treasury & FX", featureFlag: "treasury", permission: "VIEW_ALL_DATA" },
  { uiPath: "/lcr-nsfr",           label: "LCR/NSFR",          apisixPrefix: APISIX.LCR_NSFR,          backendService: "lcr-nsfr-rs",             port: 8217, section: "Treasury & FX", featureFlag: "treasury", permission: "VIEW_ALL_DATA" },
  { uiPath: "/otc-derivatives",    label: "OTC Derivatives",   apisixPrefix: APISIX.OTC_DERIVATIVES,   backendService: "otc-derivatives-rs",      port: 8161, section: "Treasury & FX", featureFlag: "treasury", permission: "VIEW_ALL_DATA" },
  { uiPath: "/securities-trading", label: "Securities Trading",apisixPrefix: APISIX.SECURITIES,        backendService: "securities-trading-rs",   port: 8254, section: "Treasury & FX", featureFlag: "securities_trading", permission: "VIEW_ALL_DATA" },

  // ── Trade Finance ─────────────────────────────────────────────────────────
  { uiPath: "/trade-finance",      label: "Trade Finance",       apisixPrefix: APISIX.TRADE_FINANCE,     backendService: "trade-finance-go",        port: 9331, section: "Trade Finance", featureFlag: "trade_finance",     permission: "VIEW_ALL_DATA" },
  { uiPath: "/bank-guarantees",    label: "Bank Guarantees",     apisixPrefix: APISIX.BANK_GUARANTEES,   backendService: "bank-guarantees-go",      port: 8080, section: "Trade Finance", featureFlag: "trade_finance",     permission: "VIEW_ALL_DATA" },
  { uiPath: "/factoring",          label: "Factoring",           apisixPrefix: APISIX.FACTORING,         backendService: "factoring-go",            port: 8080, section: "Trade Finance", featureFlag: "trade_finance",     permission: "VIEW_ALL_DATA" },
  { uiPath: "/supply-chain-finance",label: "Supply Chain Finance",apisixPrefix: APISIX.SUPPLY_CHAIN_FINANCE, backendService: "supply-chain-finance-go", port: 8158, section: "Trade Finance", featureFlag: "supply_chain_finance", permission: "VIEW_ALL_DATA" },
  { uiPath: "/diaspora-banking",   label: "Diaspora Banking",    apisixPrefix: APISIX.DIASPORA_BANKING,  backendService: "diaspora-banking-py",     port: 8135, section: "Trade Finance", featureFlag: "diaspora_banking",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/swift-messaging",    label: "SWIFT Messaging",     apisixPrefix: APISIX.SWIFT,             backendService: "swift-messaging-go",      port: 8248, section: "Trade Finance", featureFlag: "payments",          permission: "VIEW_ALL_DATA" },
  { uiPath: "/wealth-mgmt",        label: "Wealth Management",   apisixPrefix: APISIX.WEALTH_MGMT,       backendService: "wealth-mgmt-py",          port: 8168, section: "Trade Finance", featureFlag: "wealth_management", permission: "VIEW_ALL_DATA" },
  { uiPath: "/portfolio-mgmt",     label: "Portfolio Management",apisixPrefix: APISIX.PORTFOLIO_MGMT,    backendService: "portfolio-mgmt-rs",       port: 8167, section: "Trade Finance", featureFlag: "wealth_management", permission: "VIEW_ALL_DATA" },
  { uiPath: "/custody-service",    label: "Custody Service",     apisixPrefix: APISIX.CUSTODY_SERVICE,   backendService: "custody-service-go",      port: 9251, section: "Trade Finance", featureFlag: "wealth_management", permission: "VIEW_ALL_DATA" },
  { uiPath: "/trust-estate",       label: "Trust & Estate",      apisixPrefix: APISIX.TRUST_ESTATE,      backendService: "trust-estate-rs",         port: 8185, section: "Trade Finance", featureFlag: "wealth_management", permission: "VIEW_ALL_DATA" },

  // ── AML & Fraud ───────────────────────────────────────────────────────────
  { uiPath: "/ai-fraud-detection",      label: "AI Fraud Detection",   apisixPrefix: APISIX.AI_FRAUD_SCORING,  backendService: "ai-fraud-scoring-rs",       port: 8103, section: "AML & Fraud", featureFlag: "fraud_detection", permission: "VIEW_ALL_DATA" },
  { uiPath: "/aml-compliance-dashboard",label: "AML Dashboard",        apisixPrefix: APISIX.AML_COMPLIANCE_DASH, backendService: "aml-compliance-dashboard-py", port: 9207, section: "AML & Fraud", featureFlag: "aml_compliance", permission: "VIEW_ALL_DATA" },
  { uiPath: "/aml-case-manager",        label: "AML Case Manager",     apisixPrefix: APISIX.AML_CASE_MANAGER,  backendService: "aml-case-manager-go",       port: 9163, section: "AML & Fraud", featureFlag: "aml_compliance", permission: "VIEW_ALL_DATA" },
  { uiPath: "/aml-risk-scoring",        label: "AML Risk Scoring",     apisixPrefix: APISIX.AML_RISK_SCORING,  backendService: "aml-risk-scoring-rs",       port: 9203, section: "AML & Fraud", featureFlag: "aml_compliance", permission: "VIEW_ALL_DATA" },
  { uiPath: "/aml-regulatory-reporting",label: "AML Reporting",        apisixPrefix: APISIX.REGULATORY_REPORTING, backendService: "regulatory-reporting-go", port: 9072, section: "AML & Fraud", featureFlag: "aml_compliance", permission: "VIEW_ALL_DATA" },
  { uiPath: "/aml-training-tracker",    label: "AML Training",         apisixPrefix: APISIX.AML_TRAINING,      backendService: "aml-training-tracker-go",   port: 9073, section: "AML & Fraud", featureFlag: "aml_compliance", permission: "VIEW_ALL_DATA" },
  { uiPath: "/fraud-detection",         label: "Fraud Detection",      apisixPrefix: APISIX.FRAUD_DETECTION,   backendService: "fraud-detection-rs",        port: 9269, section: "AML & Fraud", featureFlag: "fraud_detection", permission: "VIEW_ALL_DATA" },
  { uiPath: "/fraud-rules",             label: "Fraud Rules",          apisixPrefix: APISIX.FRAUD_DETECTION,   backendService: "fraud-detection-rs",        port: 9269, section: "AML & Fraud", featureFlag: "fraud_detection", permission: "VIEW_ALL_DATA" },
  { uiPath: "/fraud-alerts",            label: "Fraud Alerts",         apisixPrefix: APISIX.FRAUD_DETECTION,   backendService: "fraud-detection-rs",        port: 9269, section: "AML & Fraud", featureFlag: "fraud_detection", permission: "VIEW_ALL_DATA" },
  { uiPath: "/fraud-fusion-ensemble",   label: "Fraud Ensemble",       apisixPrefix: APISIX.FRAUDFUSION,       backendService: "fraudfusion-ensemble-rs",   port: 8303, section: "AML & Fraud", featureFlag: "fraud_detection", permission: "VIEW_ALL_DATA" },
  { uiPath: "/gnn-fraud-detection",     label: "GNN Fraud Detection",  apisixPrefix: APISIX.GNN_FRAUD,         backendService: "gnn-fraud-detection-py",    port: 9271, section: "AML & Fraud", featureFlag: "fraud_detection", permission: "VIEW_ALL_DATA" },
  { uiPath: "/anomaly-detector",        label: "Anomaly Detector",     apisixPrefix: APISIX.ANOMALY_DETECTOR,  backendService: "anomaly-detector-py",       port: 9209, section: "AML & Fraud", featureFlag: "fraud_detection", permission: "VIEW_ALL_DATA" },
  { uiPath: "/txn-monitoring-rules",    label: "Txn Monitoring Rules", apisixPrefix: APISIX.TXN_MONITORING,    backendService: "txn-monitoring-rules-rs",   port: 8285, section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/txn-pattern-analyzer",    label: "Pattern Analyzer",     apisixPrefix: APISIX.TXN_PATTERN,       backendService: "txn-pattern-analyzer-py",   port: 9333, section: "AML & Fraud", featureFlag: "fraud_detection", permission: "VIEW_ALL_DATA" },
  { uiPath: "/typology-detector",       label: "Typology Detector",    apisixPrefix: APISIX.TYPOLOGY_DETECTOR, backendService: "typology-detector-rs",      port: 9314, section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/ctr-auto-filer",          label: "CTR Auto Filer",       apisixPrefix: APISIX.CTR_AUTO_FILER,    backendService: "ctr-auto-filer-go",         port: 9000, section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/sar-filing-engine",       label: "SAR Filing Engine",    apisixPrefix: APISIX.SAR_FILING,        backendService: "sar-filing-engine-go",      port: 9159, section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/sar-reports",             label: "SAR Reports",          apisixPrefix: APISIX.SAR_FILING,        backendService: "sar-filing-engine-go",      port: 9159, section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/nfiu-ctr-str-filing",     label: "NFIU CTR/STR Filing",  apisixPrefix: APISIX.NFIU_CTR_STR,      backendService: "nfiu-ctr-str-filing-py",    port: 8283, section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/go-aml-integration",      label: "goAML Integration",    apisixPrefix: APISIX.GOAML,             backendService: "goaml-integration-go",      port: 9158, section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/ndpr-compliance",         label: "NDPR Compliance",      apisixPrefix: APISIX.NDPR_COMPLIANCE,   backendService: "ndpr-compliance-py",        port: 9300, section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/compliance-checks",       label: "Compliance Checks",    apisixPrefix: APISIX.COMPLIANCE,        backendService: "compliance-service",        port: 80,   section: "AML & Fraud", featureFlag: "aml_compliance",  permission: "VIEW_ALL_DATA" },
  { uiPath: "/cbn-compliance-checker",  label: "CBN Compliance",       apisixPrefix: APISIX.CBN_COMPLIANCE,    backendService: "cbn-compliance-checker-py", port: 9235, section: "AML & Fraud", featureFlag: "regulatory_reporting", permission: "VIEW_ALL_DATA" },

  // ── Watchlists & Sanctions ─────────────────────────────────────────────────
  { uiPath: "/sanctions-screening",        label: "Sanctions Screening",  apisixPrefix: APISIX.SANCTIONS,           backendService: "sanctions-screening-rs",    port: 8283, section: "Watchlists & Sanctions", featureFlag: "sanctions_screening", permission: "VIEW_ALL_DATA" },
  { uiPath: "/sanctions-batch-rescreener", label: "Batch Rescreener",     apisixPrefix: APISIX.SANCTIONS_RESCREENER,backendService: "sanctions-batch-rescreener-rs",port: 9290, section: "Watchlists & Sanctions", featureFlag: "sanctions_screening", permission: "VIEW_ALL_DATA" },
  { uiPath: "/adverse-media",              label: "Adverse Media",        apisixPrefix: APISIX.ADVERSE_MEDIA,       backendService: "adverse-media-screening-py",port: 8080, section: "Watchlists & Sanctions", featureFlag: "sanctions_screening", permission: "VIEW_ALL_DATA" },
  { uiPath: "/adverse-media-scanner",      label: "Adverse Media Scanner",apisixPrefix: APISIX.ADVERSE_MEDIA_SCANNER,backendService: "adverse-media-scanner-py", port: 9204, section: "Watchlists & Sanctions", featureFlag: "sanctions_screening", permission: "VIEW_ALL_DATA" },
  { uiPath: "/watchlist-manager",          label: "Watchlist Manager",    apisixPrefix: APISIX.WATCHLIST_MANAGER,   backendService: "watchlist-manager-rs",      port: 9322, section: "Watchlists & Sanctions", featureFlag: "sanctions_screening", permission: "VIEW_ALL_DATA" },
  { uiPath: "/beneficial-ownership",       label: "Beneficial Ownership", apisixPrefix: APISIX.BENEFICIAL_OWNERSHIP,backendService: "beneficial-ownership-go",   port: 9096, section: "Watchlists & Sanctions", featureFlag: "sanctions_screening", permission: "VIEW_ALL_DATA" },
  { uiPath: "/ubo-ownership-graph",        label: "UBO Graph",            apisixPrefix: APISIX.UBO,                 backendService: "ubo-ownership-graph-rs",    port: 8288, section: "Watchlists & Sanctions", featureFlag: "sanctions_screening", permission: "VIEW_ALL_DATA" },
  { uiPath: "/corporate-monitoring",       label: "Corporate Monitoring", apisixPrefix: APISIX.CORPORATE_MONITORING,backendService: "corporate-monitoring-go",   port: 9248, section: "Watchlists & Sanctions", featureFlag: "sanctions_screening", permission: "VIEW_ALL_DATA" },

  // ── Regulatory Compliance ──────────────────────────────────────────────────
  { uiPath: "/regulatory-reporting", label: "Regulatory Reporting", apisixPrefix: APISIX.REGULATORY_REPORTING, backendService: "regulatory-reporting-go", port: 9072, section: "Regulatory Compliance", featureFlag: "regulatory_reporting", permission: "VIEW_ALL_DATA" },
  { uiPath: "/cbn-returns",          label: "CBN Returns",          apisixPrefix: APISIX.CBN_RETURNS,          backendService: "cbn-returns-py",          port: 9236, section: "Regulatory Compliance", featureFlag: "regulatory_reporting", permission: "VIEW_ALL_DATA" },
  { uiPath: "/efass-kyc-returns",    label: "EFASS KYC Returns",    apisixPrefix: APISIX.EFASS_KYC_RETURNS,    backendService: "efass-kyc-returns-py",    port: 9259, section: "Regulatory Compliance", featureFlag: "regulatory_reporting", permission: "VIEW_ALL_DATA" },
  { uiPath: "/tax-reporting",        label: "Tax Reporting",        apisixPrefix: APISIX.TAX_REPORTING,        backendService: "tax-reporting-py",        port: 8338, section: "Regulatory Compliance", featureFlag: "regulatory_reporting", permission: "VIEW_ALL_DATA" },
  { uiPath: "/ifrs9-engine",         label: "IFRS 9 Engine",        apisixPrefix: APISIX.IFRS9,                backendService: "ifrs9-engine-rs",         port: 8164, section: "Regulatory Compliance", featureFlag: "regulatory_reporting", permission: "VIEW_ALL_DATA" },
  { uiPath: "/fatca-crs",            label: "FATCA/CRS",            apisixPrefix: APISIX.FATCA_CRS,            backendService: "fatca-crs-rs",            port: 8188, section: "Regulatory Compliance", featureFlag: "regulatory_reporting", permission: "VIEW_ALL_DATA" },
  { uiPath: "/basel-engine",         label: "Basel Engine",         apisixPrefix: APISIX.BASEL_ENGINE,         backendService: "basel-engine-rs",         port: 9218, section: "Regulatory Compliance", featureFlag: "regulatory_reporting", permission: "VIEW_ALL_DATA" },
  { uiPath: "/kpi-dashboard",        label: "KPI Dashboard",        apisixPrefix: APISIX.KPI_ENGINE,           backendService: "kpi-engine-go",           port: 8500, section: "Regulatory Compliance", featureFlag: "reporting",            permission: "ANALYTICS" },

  // ── Finance & Accounting (typed APIs in financeApi.ts) ────────────────────
  { uiPath: "/billing",              label: "Billing",             apisixPrefix: APISIX.TENANT_BILLING,    backendService: "tenant-billing-go",       port: 8257, section: "Finance & Accounting", permission: "BILLING" },
  { uiPath: "/chart-of-accounts",    label: "Chart of Accounts",   apisixPrefix: APISIX.CHART_OF_ACCOUNTS, backendService: "chart-of-accounts-service", port: 80, section: "Finance & Accounting", featureFlag: "chart_of_accounts", permission: "BILLING" },
  { uiPath: "/gl-accounts",          label: "GL Accounts",         apisixPrefix: APISIX.GL_ENGINE,         backendService: "gl-engine-go",            port: 8090, section: "Finance & Accounting", featureFlag: "accounts",          permission: "BILLING" },
  { uiPath: "/fee-management",       label: "Fee Management",      apisixPrefix: APISIX.FEE_MANAGEMENT,    backendService: "fee-management-go",       port: 9268, section: "Finance & Accounting", featureFlag: "accounts",          permission: "BILLING" },
  { uiPath: "/interest-accrual",     label: "Interest Accrual",    apisixPrefix: APISIX.INTEREST_ACCRUAL,  backendService: "interest-accrual-engine-go", port: 8093, section: "Finance & Accounting", featureFlag: "accounts",       permission: "BILLING" },
  { uiPath: "/interest-rate",        label: "Interest Rates",      apisixPrefix: APISIX.INTEREST_RATE,     backendService: "interest-rate-engine-go", port: 9278, section: "Finance & Accounting", featureFlag: "accounts",          permission: "BILLING" },
  { uiPath: "/interest-computation", label: "Interest Computation",apisixPrefix: APISIX.INTEREST_COMPUTATION, backendService: "interest-computation-rs", port: 8336, section: "Finance & Accounting", featureFlag: "accounts",       permission: "BILLING" },
  { uiPath: "/fixed-assets",         label: "Fixed Assets",        apisixPrefix: APISIX.FIXED_ASSETS,      backendService: "fixed-assets-go",         port: 8080, section: "Finance & Accounting", featureFlag: "accounts",          permission: "BILLING" },
  { uiPath: "/expense-mgmt",         label: "Expense Management",  apisixPrefix: APISIX.EXPENSES,          backendService: "expense-mgmt-go",         port: 8080, section: "Finance & Accounting", featureFlag: "accounts",          permission: "BILLING" },
  { uiPath: "/accounting-rules",     label: "Accounting Rules",    apisixPrefix: APISIX.ACCOUNTING_RULES,  backendService: "accounting-rules-rs",     port: 8209, section: "Finance & Accounting", featureFlag: "accounts",          permission: "BILLING" },
  { uiPath: "/erp-integration",      label: "ERP Integration",     apisixPrefix: APISIX.ERP,               backendService: "erpnext-integration-service", port: 80, section: "Finance & Accounting", featureFlag: "erp_integration",  permission: "ERP_INTEGRATION" },

  // ── Settlement & Clearing ──────────────────────────────────────────────────
  { uiPath: "/cheque-clearing",      label: "Cheque Clearing",      apisixPrefix: APISIX.CHEQUE_CLEARING,       backendService: "cheque-clearing-go",      port: 9240, section: "Settlement & Clearing", featureFlag: "payments", permission: "VIEW_ALL_DATA" },
  { uiPath: "/interbank-settlement", label: "Interbank Settlement", apisixPrefix: APISIX.BANKING_CLEARING_OPS,  backendService: "banking-clearing-ops-rs", port: 1105, section: "Settlement & Clearing", featureFlag: "payments", permission: "VIEW_ALL_DATA" },
  { uiPath: "/eod-processor",        label: "EOD Processor",        apisixPrefix: APISIX.EOD_PROCESSOR,         backendService: "eod-processor-go",        port: 8207, section: "Settlement & Clearing", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/batch-eod",            label: "Batch EOD",            apisixPrefix: APISIX.BATCH_AGGREGATOR,      backendService: "batch-aggregator-go",     port: 9099, section: "Settlement & Clearing", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/batch-processing",     label: "Batch Processing",     apisixPrefix: APISIX.BATCH_PROCESSING,      backendService: "batch-processing-py",     port: 9219, section: "Settlement & Clearing", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },
  { uiPath: "/batch-aggregator",     label: "Batch Aggregator",     apisixPrefix: APISIX.BATCH_AGGREGATOR,      backendService: "batch-aggregator-go",     port: 9099, section: "Settlement & Clearing", featureFlag: "accounts", permission: "VIEW_ALL_DATA" },

  // ── Cooperative & Groups ───────────────────────────────────────────────────
  { uiPath: "/cooperative-management",     label: "Cooperative Mgmt",      apisixPrefix: APISIX.COOPERATIVE_MGMT,      backendService: "cooperative-management-go",      port: 9089, section: "Cooperative & Groups", featureFlag: "cooperative_management", permission: "APPLICATIONS" },
  { uiPath: "/cooperative-financials",     label: "Cooperative Financials",apisixPrefix: APISIX.COOPERATIVE_FINANCIALS,backendService: "cooperative-financials-py",      port: 9246, section: "Cooperative & Groups", featureFlag: "cooperative_management", permission: "VIEW_ALL_DATA" },
  { uiPath: "/cooperative-meetings",       label: "Cooperative Meetings",  apisixPrefix: APISIX.COOPERATIVE_MEETINGS,  backendService: "cooperative-meetings-go",        port: 9032, section: "Cooperative & Groups", featureFlag: "cooperative_management", permission: "APPLICATIONS" },

  // ── Agriculture ────────────────────────────────────────────────────────────
  { uiPath: "/agriculture-farmers",   label: "Farmers",              apisixPrefix: APISIX.AGRICULTURE,         backendService: "agricultural-service",   port: 8015, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agriculture-farms",     label: "Farms",                apisixPrefix: APISIX.AGRICULTURE,         backendService: "agricultural-service",   port: 8015, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agriculture-agtech",    label: "AgTech",               apisixPrefix: APISIX.AGRICULTURE,         backendService: "agricultural-service",   port: 8015, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agriculture-loans",     label: "Agri Loans",           apisixPrefix: APISIX.LOAN,                backendService: "loan-service",           port: 80,   section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agriculture-analytics", label: "Agri Analytics",       apisixPrefix: APISIX.ANALYTICS_ENGINE,   backendService: "analytics-engine-py",    port: 9208, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agriculture-insurance", label: "Agri Insurance",       apisixPrefix: APISIX.INSURANCE,          backendService: "insurance-service",      port: 80,   section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agriculture-partners",  label: "Agri Partners",        apisixPrefix: APISIX.AGRICULTURE,         backendService: "agricultural-service",   port: 8015, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agriculture-risk",      label: "Agri Risk",            apisixPrefix: APISIX.RISK_SCORING,       backendService: "risk-scoring-rs",        port: 8145, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agri-evoucher",         label: "Agri eVoucher",        apisixPrefix: APISIX.AGRI_EVOUCHER,           backendService: "agri-evoucher-go",         port: 9565, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agri-iot-sensor",       label: "IoT Sensors",          apisixPrefix: APISIX.AGRI_IOT_SENSOR,         backendService: "agri-iot-sensor-rs",       port: 9567, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agri-logistics",        label: "Agri Logistics",       apisixPrefix: APISIX.AGRI_LOGISTICS,          backendService: "agri-logistics-go",        port: 9568, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agri-savings-cycles",   label: "Savings Cycles",       apisixPrefix: APISIX.AGRI_SAVINGS_CYCLES,     backendService: "agri-savings-cycles-go",   port: 9301, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agri-reinsurance",      label: "Agri Reinsurance",     apisixPrefix: APISIX.AGRI_REINSURANCE,        backendService: "agri-reinsurance-go",      port: 9569, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/crop-yield-prediction", label: "Crop Yield Prediction",apisixPrefix: APISIX.CROP_YIELD_PREDICTION,   backendService: "crop-yield-prediction-py", port: 9129, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/farm-boundary-mapping", label: "Farm Boundary Mapping",apisixPrefix: APISIX.FARM_BOUNDARY_MAPPING,   backendService: "farm-boundary-mapping-rs", port: 9579, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/satellite-crop-monitor",label: "Satellite Monitor",    apisixPrefix: APISIX.SATELLITE_CROP_MONITOR,  backendService: "satellite-crop-monitor-rs",port: 9589, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/fisheries-aquaculture",      label: "Fisheries & Aquaculture",    apisixPrefix: APISIX.FISHERIES_AQUACULTURE,      backendService: "fisheries-aquaculture-go",        port: 9580, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/crossborder-agri-trade",     label: "Crossborder Agri Trade",     apisixPrefix: APISIX.CROSSBORDER_AGRI_TRADE,     backendService: "crossborder-agri-trade-rs",       port: 9576, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/area-yield-index-insurance", label: "Area Yield Index Insurance", apisixPrefix: APISIX.AREA_YIELD_INDEX_INSURANCE,  backendService: "area-yield-index-insurance-py",   port: 9602, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agri-input-marketplace",     label: "Agri Input Marketplace",     apisixPrefix: APISIX.AGRI_INPUT_MARKETPLACE,     backendService: "agri-input-marketplace-go",       port: 9566, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/agri-esg-impact",            label: "Agri ESG Impact",            apisixPrefix: APISIX.AGRI_ESG_IMPACT,            backendService: "agri-esg-impact-py",              port: 9564, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/soil-analysis",         label: "Soil Analysis",        apisixPrefix: APISIX.SOIL_ANALYSIS,       backendService: "soil-analysis-py",       port: 9324, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/livestock-finance",     label: "Livestock Finance",    apisixPrefix: APISIX.LIVESTOCK_FINANCE,   backendService: "livestock-finance-rs",   port: 9255, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/livestock-management",  label: "Livestock Management", apisixPrefix: APISIX.LIVESTOCK_MGMT,      backendService: "livestock-management-rs",port: 9257, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/commodity-exchange",    label: "Commodity Exchange",   apisixPrefix: APISIX.COMMODITY_EXCHANGE,  backendService: "commodity-exchange-rs",  port: 9214, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/warehouse-management",  label: "Warehouse Management", apisixPrefix: APISIX.WAREHOUSE_MGMT,      backendService: "warehouse-management-go",port: 9079, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/cbn-agri-returns",      label: "CBN Agri Returns",     apisixPrefix: APISIX.CBN_AGRI_RETURNS,     backendService: "cbn-agri-returns-py",    port: 9247, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/nirsal-agro-geocoop",   label: "NIRSAL AgroGeoCoop",   apisixPrefix: APISIX.NIRSAL_AGRO_GEOCOOP,  backendService: "nirsal-agro-geocoop-go", port: 9109, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },
  { uiPath: "/cbn-anchor-borrowers",  label: "Anchor Borrowers",     apisixPrefix: APISIX.CBN_ANCHOR_BORROWERS, backendService: "cbn-anchor-borrowers-go",port: 9107, section: "Agriculture", featureFlag: "agriculture_finance", permission: "AGRIC_BANKING" },

  // ── Customers ─────────────────────────────────────────────────────────────
  { uiPath: "/users",               label: "User Management",     apisixPrefix: APISIX.USER,              backendService: "user-service",           port: 80,   section: "Customers", featureFlag: "user_management",    permission: "MANAGE_EMPLOYEES" },
  { uiPath: "/business-management", label: "Business Mgmt",       apisixPrefix: APISIX.KYB,               backendService: "kyb-service",            port: 80,   section: "Customers", featureFlag: "user_management",    permission: "DASHBOARD" },
  { uiPath: "/communication-hub",   label: "Communication Hub",   apisixPrefix: APISIX.COMMUNICATION_HUB, backendService: "communication-hub",      port: 80,   section: "Customers", featureFlag: "communication_hub",  permission: "MANAGE_CUSTOMERS" },
  { uiPath: "/salary-processing",   label: "Salary Processing",   apisixPrefix: APISIX.SALARY_PROCESSING, backendService: "salary-processing-go",   port: 8150, section: "Customers", featureFlag: "salary_processing",  permission: "MANAGE_EMPLOYEES" },
  { uiPath: "/relationship-manager",label: "Relationship Manager",apisixPrefix: APISIX.RELATIONSHIP_MANAGER, backendService: "relationship-manager-service", port: 80, section: "Customers", featureFlag: "relationship_manager", permission: "MANAGE_CUSTOMERS" },

  // ── Digital Channels ──────────────────────────────────────────────────────
  { uiPath: "/ussd-banking-gateway",      label: "USSD Banking",      apisixPrefix: APISIX.USSD_BANKING_GW,  backendService: "ussd-banking-gateway-go",     port: 9057, section: "Digital Channels", featureFlag: "ussd_banking",    permission: "VIEW_ALL_DATA" },
  { uiPath: "/whatsapp-banking-flows",    label: "WhatsApp Banking",  apisixPrefix: APISIX.WHATSAPP_BANKING,  backendService: "whatsapp-banking-flows-rs",   port: 9323, section: "Digital Channels", featureFlag: "whatsapp_banking", permission: "VIEW_ALL_DATA" },
  { uiPath: "/whatsapp-business-gateway",label: "WhatsApp Gateway",  apisixPrefix: APISIX.WHATSAPP_GATEWAY,  backendService: "whatsapp-business-gateway-go",port: 9141, section: "Digital Channels", featureFlag: "whatsapp_banking", permission: "VIEW_ALL_DATA" },
  { uiPath: "/sms-banking",               label: "SMS Banking",       apisixPrefix: APISIX.SMS_BANKING,       backendService: "sms-banking",                 port: 8080, section: "Digital Channels", featureFlag: "payments",         permission: "VIEW_ALL_DATA" },
  { uiPath: "/telegram-bot-gateway",      label: "Telegram Bot",      apisixPrefix: APISIX.TELEGRAM_BOT_GW,  backendService: "telegram-bot-gateway-go",     port: 9003, section: "Digital Channels", featureFlag: "chatbot",          permission: "VIEW_ALL_DATA" },
  { uiPath: "/telegram-banking-commands", label: "Telegram Banking",  apisixPrefix: APISIX.TELEGRAM_COMMANDS, backendService: "telegram-banking-commands-rs",port: 9303, section: "Digital Channels", featureFlag: "chatbot",          permission: "VIEW_ALL_DATA" },
  { uiPath: "/voice-banking-gateway",     label: "Voice Banking",     apisixPrefix: APISIX.VOICE_BANKING_GW,  backendService: "voice-banking-gateway-go",    port: 9048, section: "Digital Channels", featureFlag: "payments",         permission: "VIEW_ALL_DATA" },
  { uiPath: "/chatbot",                   label: "Chatbot",           apisixPrefix: APISIX.CHATBOT,           backendService: "chatbot-py",                  port: 9239, section: "Digital Channels", featureFlag: "chatbot",          permission: "VIEW_ALL_DATA" },
  { uiPath: "/identity-channels",         label: "Identity Channels", apisixPrefix: APISIX.IDENTITY_CHANNELS, backendService: "identity-channels-go",        port: 9274, section: "Digital Channels", featureFlag: "user_management",  permission: "VIEW_ALL_DATA" },

  // ── Notifications ─────────────────────────────────────────────────────────
  { uiPath: "/notification-center",      label: "Notification Center",   apisixPrefix: APISIX.NOTIFICATION,           backendService: "notification-service-go", port: 9302, section: "Notifications", featureFlag: "alerts",            permission: "VIEW_ALL_DATA" },
  { uiPath: "/notification-preferences", label: "Notification Prefs",    apisixPrefix: APISIX.NOTIFICATION,           backendService: "notification-service-go", port: 9302, section: "Notifications", featureFlag: "alert_settings",    permission: "VIEW_ALL_DATA" },
  { uiPath: "/webhook-engine",           label: "Webhook Engine",        apisixPrefix: APISIX.WEBHOOKS,               backendService: "webhook-engine-go",       port: 8238, section: "Notifications", featureFlag: "developer_platform",permission: "VIEW_ALL_DATA" },
  { uiPath: "/webhook-deliveries",       label: "Webhook Deliveries",    apisixPrefix: APISIX.WEBHOOKS,               backendService: "webhook-engine-go",       port: 8238, section: "Notifications", featureFlag: "developer_platform",permission: "VIEW_ALL_DATA" },
  { uiPath: "/webhook-subscriptions",    label: "Webhook Subscriptions", apisixPrefix: APISIX.WEBHOOKS,               backendService: "webhook-engine-go",       port: 8238, section: "Notifications", featureFlag: "developer_platform",permission: "VIEW_ALL_DATA" },
  { uiPath: "/sms-alert-notification",   label: "SMS Alerts",            apisixPrefix: APISIX.SMS_ALERT_NOTIFICATION, backendService: "sms-alert-notification-py",port: 9321, section: "Notifications", featureFlag: "alerts",            permission: "VIEW_ALL_DATA" },

  // ── Workflow & Documents ───────────────────────────────────────────────────
  { uiPath: "/approval-workflow",    label: "Approval Workflow",    apisixPrefix: APISIX.APPROVAL_WORKFLOW, backendService: "approval-workflow-go",  port: 9213, section: "Workflow & Documents", featureFlag: "maker_checker",       permission: "VIEW_ALL_DATA" },
  { uiPath: "/workflow-engine",      label: "Workflow Engine",      apisixPrefix: APISIX.WORKFLOW_ENGINE,   backendService: "workflow-engine-py",    port: 8123, section: "Workflow & Documents", featureFlag: "maker_checker",       permission: "VIEW_ALL_DATA" },
  { uiPath: "/workflow-definitions", label: "Workflow Definitions", apisixPrefix: APISIX.WORKFLOW_ENGINE,   backendService: "workflow-engine-py",    port: 8123, section: "Workflow & Documents", featureFlag: "maker_checker",       permission: "VIEW_ALL_DATA" },
  { uiPath: "/workflow-instances",   label: "Workflow Instances",   apisixPrefix: APISIX.WORKFLOW_ENGINE,   backendService: "workflow-engine-py",    port: 8123, section: "Workflow & Documents", featureFlag: "maker_checker",       permission: "VIEW_ALL_DATA" },
  { uiPath: "/maker-checker",        label: "Maker-Checker",        apisixPrefix: APISIX.MAKER_CHECKER,     backendService: "maker-checker-go",      port: 8210, section: "Workflow & Documents", featureFlag: "maker_checker",       permission: "VIEW_ALL_DATA" },
  { uiPath: "/document-management",  label: "Document Management",  apisixPrefix: APISIX.DOCUMENT_MANAGEMENT,backendService: "document-management-py",port: 8152, section: "Workflow & Documents", featureFlag: "document_management", permission: "VIEW_ALL_DATA" },

  // ── Compliance & Audit ─────────────────────────────────────────────────────
  { uiPath: "/dispute",               label: "Dispute",        apisixPrefix: APISIX.DISPUTE,          backendService: "dispute-service",        port: 80,   section: "Compliance & Audit", featureFlag: "disputes",        permission: "DISPUTE_MANAGEMENT" },
  { uiPath: "/disputes",              label: "Disputes",       apisixPrefix: APISIX.DISPUTE,          backendService: "dispute-service",        port: 80,   section: "Compliance & Audit", featureFlag: "disputes",        permission: "DISPUTE_MANAGEMENT" },
  { uiPath: "/dispute-management",    label: "Dispute Mgmt",   apisixPrefix: APISIX.DISPUTE_MANAGEMENT,backendService: "dispute-management-py",  port: 9255, section: "Compliance & Audit", featureFlag: "disputes",        permission: "DISPUTE_MANAGEMENT" },
  { uiPath: "/audit-logs",            label: "Audit Logs",     apisixPrefix: APISIX.AUDIT,            backendService: "audit-service",          port: 80,   section: "Compliance & Audit", featureFlag: "audit",           permission: "VIEW_AUDIT_LOGS" },
  { uiPath: "/audit-trail",           label: "Audit Trail",    apisixPrefix: APISIX.AUDIT,            backendService: "audit-service",          port: 80,   section: "Compliance & Audit", featureFlag: "audit",           permission: "VIEW_AUDIT_LOGS" },
  { uiPath: "/admin/temporal-access", label: "Temporal Access",apisixPrefix: APISIX.TEMPORAL_ACCESS,  backendService: "temporal-access-service",port: 80,   section: "Compliance & Audit", featureFlag: "temporal_access", permission: "DASHBOARD" },
  { uiPath: "/my-access",             label: "My Permissions", apisixPrefix: APISIX.AUTH_ENFORCER,    backendService: "auth-enforcer-rs",       port: 8314, section: "Compliance & Audit", featureFlag: "auth",            permission: "DASHBOARD" },

  // ── Monitoring & Alerts ────────────────────────────────────────────────────
  { uiPath: "/monitoring",      label: "Monitoring",     apisixPrefix: APISIX.OPS_DASHBOARD,    backendService: "ops-dashboard",      port: 8090, section: "Monitoring & Alerts", featureFlag: "monitoring",      permission: "VIEW_ALL_DATA" },
  { uiPath: "/usage-analytics", label: "Usage Analytics",apisixPrefix: APISIX.ANALYTICS_ENGINE, backendService: "analytics-engine-py",port: 9208, section: "Monitoring & Alerts", featureFlag: "usage_analytics", permission: "ANALYTICS" },

  // ── Administration ─────────────────────────────────────────────────────────
  { uiPath: "/admin/admins",    label: "Admin Management", apisixPrefix: APISIX.ADMIN,       backendService: "admin-service",        port: 80,   section: "Administration", featureFlag: "admin_management", permission: "DASHBOARD" },
  { uiPath: "/institutions",    label: "Institution Mgmt", apisixPrefix: APISIX.TENANT_MGMT, backendService: "tenant-management",    port: 80,   section: "Administration", featureFlag: "auth",             permission: "MANAGE_EMPLOYEES" },
  { uiPath: "/admin/analytics", label: "Analytics",        apisixPrefix: APISIX.ANALYTICS_ENGINE, backendService: "analytics-engine-py", port: 9208, section: "Administration", featureFlag: "reporting",       permission: "ANALYTICS" },
] as const;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Get the APISIX prefix for a given UI route path. */
export function getApisixPrefix(uiPath: string): ApisixPrefix | undefined {
  return ROUTE_REGISTRY.find((r) => r.uiPath === uiPath)?.apisixPrefix;
}

/** Get the full registry entry for a UI path. */
export function getRouteEntry(uiPath: string): RouteRegistryEntry | undefined {
  return ROUTE_REGISTRY.find((r) => r.uiPath === uiPath) as RouteRegistryEntry | undefined;
}

/** Get all routes for a given sidebar section. */
export function getRoutesBySection(section: string): RouteRegistryEntry[] {
  return ROUTE_REGISTRY.filter((r) => r.section === section) as RouteRegistryEntry[];
}

/** Derive a health-check URL for a route entry. */
export function getHealthUrl(entry: RouteRegistryEntry): string {
  return `${entry.apisixPrefix}/healthz`;
}
