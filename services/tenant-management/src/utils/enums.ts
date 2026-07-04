export enum SupportedDatabaseTypes {
  MY_SQL = "mysql",
  POSTGRES = "postgres",
}

export enum TenantStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ONBOARDING = "onboarding",
  SUSPENDED = "suspended",
  DISABLED = "disabled",
}

export enum FeatureFlag {
  // Core
  AUTH = "auth",
  USER_MANAGEMENT = "user_management",
  ACCOUNTS = "accounts",
  PAYMENTS = "payments",
  REPORTING = "reporting",
  NOTIFICATIONS = "notifications",
  KYC_KYB = "kyc_kyb",
  COMPLIANCE = "compliance",
  AUDIT = "audit",

  // Banking Channels
  MOBILE_BANKING = "mobile_banking",
  USSD_BANKING = "ussd_banking",
  WHATSAPP_BANKING = "whatsapp_banking",
  AGENT_BANKING = "agent_banking",
  CHATBOT = "chatbot",
  POS_TERMINAL = "pos_terminal",

  // Payments & Transfers
  BILL_PAYMENTS = "bill_payments",
  QR_PAYMENTS = "qr_payments",
  BULK_PAYMENTS = "bulk_payments",
  STANDING_ORDERS = "standing_orders",
  REMITTANCE = "remittance",
  ATM_MANAGEMENT = "atm_management",

  // Cards & Accounts
  TELLER = "teller",
  CARD_MANAGEMENT = "card_management",
  VIRTUAL_ACCOUNTS = "virtual_accounts",
  FX = "fx",

  // Lending & Credit
  LOANS = "loans",
  EDUCATION_LOANS = "education_loans",
  MORTGAGE = "mortgage",
  LPO = "lpo",
  BNPL = "bnpl",

  // Savings & Investments
  SAVINGS = "savings",
  SMART_SAVINGS = "smart_savings",
  ESUSU = "esusu",
  ESCROW = "escrow",
  INVESTMENT = "investment",

  // Risk, Fraud & Compliance
  FRAUD_DETECTION = "fraud_detection",
  RISK_MANAGEMENT = "risk_management",
  DISPUTE = "dispute",
  AML_COMPLIANCE = "aml_compliance",
  SANCTIONS_SCREENING = "sanctions_screening",
  REGULATORY_REPORTING = "regulatory_reporting",

  // Insurance
  INSURANCE = "insurance",
  ETHERISC = "etherisc",

  // Treasury & Finance
  TREASURY = "treasury",
  CHART_OF_ACCOUNTS = "chart_of_accounts",
  RECONCILIATION = "reconciliation",
  FINANCE = "finance",

  // Specialised Finance
  ISLAMIC_BANKING = "islamic_banking",
  AGRICULTURE_FINANCE = "agriculture_finance",
  SUPPLY_CHAIN_FINANCE = "supply_chain_finance",
  TRADE_FINANCE = "trade_finance",
  CARBON_CREDITS = "carbon_credits",
  COOPERATIVE_MANAGEMENT = "cooperative_management",
  DIASPORA_BANKING = "diaspora_banking",
  MICROFINANCE = "microfinance",

  // Wealth & Capital Markets
  WEALTH_MANAGEMENT = "wealth_management",
  PENSION = "pension",
  LEASING = "leasing",
  SECURITIES_TRADING = "securities_trading",

  // Operations & Workflow
  EMPLOYEE_MANAGEMENT = "employee_management",
  RELATIONSHIP_MANAGER = "relationship_manager",
  DOCUMENT_MANAGEMENT = "document_management",
  COMMUNICATION_HUB = "communication_hub",
  MERCHANT_MANAGEMENT = "merchant_management",
  SALARY_PROCESSING = "salary_processing",
  MAKER_CHECKER = "maker_checker",
  PRODUCT_FACTORY = "product_factory",
  GAMIFICATION = "gamification",

  // Platform & Integration
  OPEN_BANKING = "open_banking",
  BIOMETRIC_AUTH = "biometric_auth",
  DEVELOPER_PLATFORM = "developer_platform",
  ERP_INTEGRATION = "erp_integration",
  TEMPORAL_ACCESS = "temporal_access",
}

export enum BillingPlan {
  STANDARD = "standard",
  PREMIUM = "premium",
  ENTERPRISE = "enterprise",
}

export enum BillingPeriod {
  MONTHLY = "monthly",
  ANNUAL = "annual",
}

export enum OnboardingWorkflowStatus {
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum TenantType {
  BANK = "bank",
  MICROFINANCE = "microfinance",
  FINTECH = "fintech",
  INSURANCE = "insurance",
}

