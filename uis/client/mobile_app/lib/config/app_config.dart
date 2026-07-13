class AppConfig {
  // Set this to change the active tenant (match web env logic)
  static const String CURRENT_TENANT_ID = 'pup'; //this value to switch tenants
  // API Configuration
  static const String baseUrl = 'https://54link-dev.upi.dev';
  static const String stagingUrl = 'https://54link-dev.upi.dev';
  
  // API Endpoints (matching web app exactly)
  static const String authEndpoint = '/auth';
  static const String accountEndpoint = '/account/account';
  static const String userEndpoint = '/user';
  static const String walletEndpoint = '/ledger';
  static const String paymentEndpoint = '/payment-processing';
  static const String paymentHubEndpoint = '/payment-hub';
  static const String notificationEndpoint = '/orchestrator/notifications';
  static const String kycEndpoint = '/verification/kyc';
  static const String loanEndpoint = '/loan/api/v1'; // Matching web app
  static const String lpoEndpoint = '/lpo/api/v1'; // Matching web app
  static const String chequeEndpoint = '/payment-processing/cheques';
  static const String scheduledPaymentEndpoint = '/payment-processing/scheduled-payments';
  static const String transactionEndpoint = '/ledger/txn'; // Matching web app
  static const String savingsEndpoint = '/savings/api/v1';
  static const String disputeEndpoint = '/dispute/api/v1/disputes'; // Matching web app
  static const String fxEndpoint = '/payment-processing/fx';
  static const String pensionEndpoint = '/orchestrator/pensions';
  static const String carbonEndpoint = '/carbon';
  static const String cardEndpoint = '/card/api/v1/cards';
  static const String insuranceEndpoint = '/insurance';
  static const String complianceEndpoint = '/compliance';
  static const String sanctionsEndpoint = '/sanctions-screening';
  static const String reportingEndpoint = '/reporting';
  static const String tenantEndpoint = '/tenant-management';
  static const String supplyChainEndpoint = '/supply-chain';
  static const String orchestratorEndpoint = '/orchestrator';
  static const String rewardEndpoint = '/orchestrator/rewards';
  static const String investmentEndpoint = '/investments'; // Matching web app
  static const String billEndpoint = '/payment-processing/bills'; // Matching web app
  static const String agricultureEndpoint = '/agricultural/api/v1/agriculture'; // Corrected to match backend endpoints
  static const String voiceBankingEndpoint = '/voice-banking'; // Matching web app
  static const String mortgageEndpoint = '/mortgage/api/v1/mortgages'; // Matching web app
  static const String islamicBankingEndpoint = '/islamic-banking/api/v1'; // Islamic banking products
  static const String enairaCbdcEndpoint = '/enaira-cbdc';
  static const String remittanceEndpoint = '/remittance';
  static const String wealthEndpoint = '/wealth';
  static const String businessEndpoint = '/business/api/v1';
  
  // App Configuration
  static const String appName = 'pup'; // Deprecated: Use tenant.displayName instead
  static const String appVersion = '1.0.0';
  static const int apiTimeout = 60; // seconds - reduced for better mobile experience
  
  // Storage Keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userDataKey = 'user_data';
  static const String biometricEnabledKey = 'biometric_enabled';
  static const String fcmTokenKey = 'fcm_token';
  
  // Feature Flags
  static const bool enableBiometrics = true;
  static const bool enableQRPayments = true;
  static const bool enablePushNotifications = true;
  
  // UI Configuration
  static const double borderRadius = 12.0;
  static const double buttonHeight = 56.0;
  static const double spacing = 16.0;
  
  // Transaction Limits
  static const double minTransferAmount = 100.0;
  static const double maxTransferAmount = 1000000.0;
  static const double dailyTransferLimit = 5000000.0;
}
