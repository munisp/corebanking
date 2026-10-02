export class AppConfig {
  // API Configuration
  static readonly baseUrl: string = "https://54link-dev.upi.dev";
  static readonly stagingUrl: string = "https://54link-dev.upi.dev";

  // API Endpoints
  static readonly authEndpoint: string = "/auth";
  static readonly accountEndpoint: string = "/account/account";
  static readonly userEndpoint: string = "/user";
  static readonly walletEndpoint: string = "/ledger";
  static readonly paymentEndpoint: string = "/payment-processing";
  static readonly notificationEndpoint: string = "/orchestrator/notifications";
  static readonly kycEndpoint: string = "/verification/kyc";
  static readonly loanEndpoint: string = "/loan/api/v1/loans";
  static readonly lpoEndpoint: string = "/lpo/api/v1";
  static readonly chequeEndpoint: string = "/payment-processing/cheques";
  // W12-A4B: scheduled payments are served by standing-orders-go
  // (gateway /standing-orders/* -> /v1/standing-orders*); payment-processing
  // never had a scheduled-payments route.
  static readonly scheduledPaymentEndpoint: string =
    "/standing-orders/v1/standing-orders";
  static readonly transactionEndpoint: string = "/ledger/txn";
  static readonly savingsEndpoint: string = "/savings/api/v1";
  static readonly disputeEndpoint: string = "/dispute/api/v1/disputes";
  // W12-A4B: fx-service is gateway-exposed at /fx/* with rewrite
  // /fx/v1/(.*) -> /api/v1/fx/$1 (rates/exchange/transactions).
  static readonly fxEndpoint: string = "/fx/v1";
  static readonly pensionEndpoint: string = "/orchestrator/pensions";
  static readonly carbonEndpoint: string = "/carbon";
  static readonly cardEndpoint: string = "/card/api/v1/cards";
  static readonly insuranceEndpoint: string = "/insurance";
  static readonly complianceEndpoint: string = "/compliance";
  static readonly sanctionsEndpoint: string = "/sanctions-screening";
  static readonly reportingEndpoint: string = "/reporting";
  static readonly tenantEndpoint: string = "/tenant-management";
  static readonly supplyChainEndpoint: string = "/supply-chain";
  static readonly orchestratorEndpoint: string = "/orchestrator";
  static readonly rewardEndpoint: string = "/orchestrator/rewards";
  static readonly investmentEndpoint: string = "/investments";
  // W12-A4B: bills/billers are served by mobile-bff
  // (/mobile-bff/* -> /api/v1/*; routes /api/v1/bills/pay|validate, /api/v1/billers).
  static readonly billEndpoint: string = "/mobile-bff/api/v1/bills";
  static readonly agricultureEndpoint: string =
    "/agricultural/api/v1/agriculture";
  static readonly voiceBankingEndpoint: string = "/voice-banking";
  static readonly mortgageEndpoint: string = "/mortgage/api/v1/mortgages";
  static readonly islamicBankingEndpoint: string = "/islamic-banking/api/v1";
  static readonly enairaCbdcEndpoint: string = "/enaira-cbdc";
  static readonly remittanceEndpoint: string = "/remittance";
  static readonly wealthEndpoint: string = "/wealth";
  static readonly paymentHubEndpoint: string = "/payment-hub";
  static readonly businessEndpoint: string = "/business/api/v1";

  // App Configuration
  // Note: appName is now dynamically loaded from tenant config - see useTenant() hook
  static readonly appName: string = "54link-dev"; // Deprecated: Use tenant.displayName instead
  static readonly appVersion: string = "1.0.0";
  static readonly apiTimeout: number = 60; // seconds - increased for better reliability
  static readonly DEFAULT_TENANT_ID: string =
    import.meta.env.VITE_TENANT_ID || import.meta.env.VITE_DEFAULT_TENANT_ID || "pup";

  // Storage Keys
  static readonly accessTokenKey: string = "access_token";
  static readonly refreshTokenKey: string = "refresh_token";
  static readonly userDataKey: string = "user_data";
  static readonly biometricEnabledKey: string = "biometric_enabled";
  static readonly fcmTokenKey: string = "fcm_token";

  // Feature Flags
  static readonly enableBiometrics: boolean = true;
  static readonly enableQRPayments: boolean = true;
  static readonly enablePushNotifications: boolean = true;

  // UI Configuration
  static readonly borderRadius: number = 12.0;
  static readonly buttonHeight: number = 56.0;
  static readonly spacing: number = 16.0;

  // Transaction Limits
  static readonly minTransferAmount: number = 100.0;
  static readonly maxTransferAmount: number = 1000000.0;
  static readonly dailyTransferLimit: number = 5000000.0;
}
