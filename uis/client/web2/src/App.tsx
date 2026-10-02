import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Footer from './components/Footer';
import Navigation from './components/Navigation';
import MobileBottomNav from './components/MobileBottomNav';
import { OfflineScreen } from './components/OfflineScreen';
import { SyncStatusIndicator } from './components/SyncStatusIndicator';
import TenantIndicator from './components/TenantIndicator';
import { TenantInitializer } from './components/TenantInitializer';
import TenantSwitcher from './components/TenantSwitcher';
const ChangePasswordScreen = lazy(() => import('./pages/auth/change_password_screen'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassaword'));
const ResetPasswordScreen = lazy(() => import('./pages/auth/reset_password_screen'));
const Login = lazy(() => import('./pages/auth/Login'));
const PasswordCreatedScreen = lazy(() => import('./pages/auth/password_created_screen'));
const Register = lazy(() => import('./pages/auth/Register'));
const BankDetailsScreen = lazy(() => import('./pages/customer_screens/account/bank_details'));
const BvnVerificationScreen = lazy(() => import('./pages/customer_screens/account/bvn_verification_screen'));
const CompleteProfileScreen = lazy(() => import('./pages/customer_screens/account/complete_profile_screen'));
const AccountsScreen = lazy(() => import('./pages/customer_screens/accounts/AccountsScreen'));
const AgricultureDashboardScreen = lazy(() => import('./pages/customer_screens/agriculture/AgricultureDashboardScreen'));
const FarmersScreen = lazy(() => import('./pages/customer_screens/agriculture/farmers/FarmersScreen'));
const FarmsListScreen = lazy(() => import('./pages/customer_screens/agriculture/farms/FarmsListScreen'));
const AgTechScreen = lazy(() => import('./pages/customer_screens/agriculture/agtech/AgTechScreen'));
const AgriLoansScreen = lazy(() => import('./pages/customer_screens/agriculture/loans/AgriLoansScreen'));
const FarmerRegistrationScreen = lazy(() => import('./pages/customer_screens/agriculture/FarmerRegistrationScreen'));
const FarmRegistrationScreen = lazy(() => import('./pages/customer_screens/agriculture/FarmRegistrationScreen'));
const InclusiveAccessScreen = lazy(() => import('./pages/customer_screens/agriculture/InclusiveAccessScreen'));
const ProactiveRiskScreen = lazy(() => import('./pages/customer_screens/agriculture/ProactiveRiskScreen'));
const RegulatoryScreen = lazy(() => import('./pages/customer_screens/agriculture/RegulatoryScreen'));
const RiskAlertsScreen = lazy(() => import('./pages/customer_screens/agriculture/RiskAlertsScreen'));
const ValueChainScreen = lazy(() => import('./pages/customer_screens/agriculture/ValueChainScreen'));
const WeatherScreen = lazy(() => import('./pages/customer_screens/agriculture/WeatherScreen'));
const FarmerProductsScreen = lazy(() => import('./pages/customer_screens/agriculture/FarmerProductsScreen'));
const FarmerImpactScreen = lazy(() => import('./pages/customer_screens/agriculture/FarmerImpactScreen'));
const AgricultureInsuranceClientScreen = lazy(() => import('./pages/customer_screens/agriculture/AgricultureInsuranceClientScreen'));
const GovernmentProgramsScreen = lazy(() => import('./pages/customer_screens/agriculture/GovernmentProgramsScreen'));
const CarbonCreditsScreen = lazy(() => import('./pages/customer_screens/carbon_credits/carbon_credits_screen'));
const CardScreen = lazy(() => import('./pages/customer_screens/cards/card_screen'));
const Dashboard = lazy(() => import('./pages/customer_screens/dashboard/Dashboard'));
const DepositScreen = lazy(() => import('./pages/customer_screens/deposit/deposit_screen'));
const CreateDisputeScreen = lazy(() => import('./pages/customer_screens/disputes/CreateDisputeScreen'));
const DisputesListScreen = lazy(() => import('./pages/customer_screens/disputes/DisputesListScreen'));
const BNPLApplyScreen = lazy(() => import('./pages/customer_screens/bnpl/BNPLApplyScreen'));
const BNPLListScreen = lazy(() => import('./pages/customer_screens/bnpl/BNPLListScreen'));
const OpenBankingConsentScreen = lazy(() => import('./pages/customer_screens/open_banking/OpenBankingConsentScreen'));
const EducationLoanApplicationScreen = lazy(() => import('./pages/customer_screens/education/EducationLoanApplicationScreen'));
const EducationLoanListScreen = lazy(() => import('./pages/customer_screens/education/EducationLoanListScreen'));
const EducationLoanDetailScreen = lazy(() => import('./pages/customer_screens/education/EducationLoanDetailScreen'));
const EscrowListScreen = lazy(() => import('./pages/customer_screens/escrow/EscrowListScreen'));
const EscrowDetailScreen = lazy(() => import('./pages/customer_screens/escrow/EscrowDetailScreen'));
const CreateEscrowScreen = lazy(() => import('./pages/customer_screens/escrow/CreateEscrowScreen'));
const EsusuScreen = lazy(() => import('./pages/customer_screens/esusu/EsusuScreen'));
const FaceScanningScreen = lazy(() => import('./pages/customer_screens/face_verification/face_scanning_screen'));
const FaceVerificationScreen = lazy(() => import('./pages/customer_screens/face_verification/face_verification_screen'));
const FaceVerificationSuccessScreen = lazy(() => import('./pages/customer_screens/face_verification/face_verification_success'));
const InsuranceScreen = lazy(() => import('./pages/customer_screens/insurance/insurance_screen'));
const LoanDetailsScreen = lazy(() => import('./pages/customer_screens/loans/loan_details_screen'));
const LoansApplicationScreen = lazy(() => import('./pages/customer_screens/loans/loans_application_screen'));
const LoansListScreen = lazy(() => import('./pages/customer_screens/loans/LoansListScreen'));
const ProjectFinanceApplyScreen = lazy(() => import('./pages/customer_screens/loans/ProjectFinanceApplyScreen'));
const EquipmentLeasingApplyScreen = lazy(() => import('./pages/customer_screens/agriculture/EquipmentLeasingApplyScreen'));
const LPOListScreen = lazy(() => import('./pages/customer_screens/lpo/LPOListScreen'));
const LPOApplicationScreen = lazy(() => import('./pages/customer_screens/lpos/lpo_application_screen'));
const LPODetailsScreen = lazy(() => import('./pages/customer_screens/lpos/lpo_details_screen'));
const MoreActionsScreen = lazy(() => import('./pages/customer_screens/more_actions/MoreActionsScreen'));
const MortgageApplicationScreen = lazy(() => import('./pages/customer_screens/mortgage/MortgageApplicationScreen'));
const MortgageDetailScreen = lazy(() => import('./pages/customer_screens/mortgage/MortgageDetailScreen'));
const MortgageListScreen = lazy(() => import('./pages/customer_screens/mortgage/MortgageListScreen'));
const NotificationScreen = lazy(() => import('./pages/customer_screens/notification/notification_screen'));
const EmailOtpScreen = lazy(() => import('./pages/customer_screens/otp/email_otp'));
const LoginOtpScreen = lazy(() => import('./pages/customer_screens/otp/login_otp'));
const CreatePinScreen = lazy(() => import('./pages/customer_screens/pin/create_pin'));
const ForgotPinScreen = lazy(() => import('./pages/customer_screens/pin/forgot_pin'));
const InputPinScreen = lazy(() => import('./pages/customer_screens/pin/input_pin'));
const PinCreatedScreen = lazy(() => import('./pages/customer_screens/pin/pin_created'));
const QRCodeScreen = lazy(() => import('./pages/customer_screens/qrcode/qrcode_screen'));
const RewardsScreen = lazy(() => import('./pages/customer_screens/rewards/rewards_screen'));
const CreateSavingsScreen = lazy(() => import('./pages/customer_screens/savings/CreateSavingsScreen'));
const SavingsDetailsScreen = lazy(() => import('./pages/customer_screens/savings/SavingsDetailsScreen'));
const SavingsListScreen = lazy(() => import('./pages/customer_screens/savings/SavingsListScreen'));
const ScheduledPaymentsScreen = lazy(() => import('./pages/customer_screens/scheduled_payments/ScheduledPaymentsScreen'));
const FaqScreen = lazy(() => import('./pages/customer_screens/settings/faq_screen'));
const NetworkMonitorScreen = lazy(() => import('./pages/customer_screens/settings/network_monitor_screen'));
const Settings = lazy(() => import('./pages/customer_screens/settings/settings_screen'));
const SupportScreen = lazy(() => import('./pages/customer_screens/settings/support_screen'));
const BankStatementScreen = lazy(() => import('./pages/customer_screens/transaction/bank_statement_screen'));
const ReceiptScreen = lazy(() => import('./pages/customer_screens/transaction/receipt_screen'));
const TransactionHistory = lazy(() => import('./pages/customer_screens/transaction/transaction_history'));
const BeneficiariesScreen = lazy(() => import('./pages/customer_screens/transfers/beneficiaries_screen'));
const Transfer = lazy(() => import('./pages/customer_screens/transfers/transfer_screen'));
const BulkTransferScreen = lazy(() => import('./pages/customer_screens/transfers/bulk_transfer_screen'));
const VANManagementScreen = lazy(() => import('./pages/customer_screens/van/VANManagementScreen'));
const FXScreen = lazy(() => import('./pages/customer_screens/fx/FXScreen'));
const PensionsScreen = lazy(() => import('./pages/customer_screens/pensions/PensionsScreen'));
const InvestmentsScreen = lazy(() => import('./pages/customer_screens/investments/InvestmentsScreen'));
const ChequesScreen = lazy(() => import('./pages/customer_screens/cheques/ChequesScreen'));
const BillPaymentScreen = lazy(() => import('./pages/customer_screens/bills/bill_payment_screen'));
const VoiceAssistantScreen = lazy(() => import('./pages/customer_screens/voice_banking/VoiceAssistantScreen'));
const VoiceASRNigerianScreen = lazy(() => import('./pages/customer_screens/voice_banking/VoiceASRNigerianScreen'));
const VoiceTTSNigerianScreen = lazy(() => import('./pages/customer_screens/voice_banking/VoiceTTSNigerianScreen'));
const VoiceBiometricAuthScreen = lazy(() => import('./pages/customer_screens/voice_banking/VoiceBiometricAuthScreen'));
const VoiceIVRMenuScreen = lazy(() => import('./pages/customer_screens/voice_banking/VoiceIVRMenuScreen'));
const VoiceNLUBankingScreen = lazy(() => import('./pages/customer_screens/voice_banking/VoiceNLUBankingScreen'));
const VoiceBankingGatewayScreen = lazy(() => import('./pages/customer_screens/voice_banking/VoiceBankingGatewayScreen'));
const VoiceAgentEscalationScreen = lazy(() => import('./pages/customer_screens/voice_banking/VoiceAgentEscalationScreen'));
const TradeFinanceDashboardScreen = lazy(() => import('./pages/customer_screens/trade_finance/TradeFinanceDashboardScreen'));
const LCListScreen = lazy(() => import('./pages/customer_screens/trade_finance/LCListScreen'));
const LCApplyScreen = lazy(() => import('./pages/customer_screens/trade_finance/LCApplyScreen'));
const LCDetailsScreen = lazy(() => import('./pages/customer_screens/trade_finance/LCDetailsScreen'));
const BankGuaranteeListScreen = lazy(() => import('./pages/customer_screens/trade_finance/BankGuaranteeListScreen'));
const BankGuaranteeApplyScreen = lazy(() => import('./pages/customer_screens/trade_finance/BankGuaranteeApplyScreen'));
const FactoringListScreen = lazy(() => import('./pages/customer_screens/trade_finance/FactoringListScreen'));
const FactoringApplyScreen = lazy(() => import('./pages/customer_screens/trade_finance/FactoringApplyScreen'));
const BiometricEnrollmentScreen = lazy(() => import('./pages/customer_screens/biometric/BiometricEnrollmentScreen'));
const BNPLDetailsScreen = lazy(() => import('./pages/customer_screens/bnpl/BNPLDetailsScreen'));
const EducationLoanUpdateScreen = lazy(() => import('./pages/customer_screens/education/EducationLoanUpdateScreen'));
const KYCCompleteSuccessScreen = lazy(() => import('./pages/onboarding/KYCCompleteSuccessScreen'));
const DiasporaBankingScreen = lazy(() => import('./pages/customer_screens/diaspora/DiasporaBankingScreen'));
const ENairaCBDCScreen = lazy(() => import('./pages/customer_screens/cbdc/ENairaCBDCScreen'));
const WealthManagementScreen = lazy(() => import('./pages/customer_screens/wealth/WealthManagementScreen'));
const RemittanceScreen = lazy(() => import('./pages/customer_screens/remittance/RemittanceScreen'));
const AgriEvoucherScreen = lazy(() => import('./pages/customer_screens/agriculture/AgriEvoucherScreen'));
const AgriInputMarketplaceScreen = lazy(() => import('./pages/customer_screens/agriculture/AgriInputMarketplaceScreen'));
const AgriIotSensorScreen = lazy(() => import('./pages/customer_screens/agriculture/AgriIotSensorScreen'));
const AgriLogisticsScreen = lazy(() => import('./pages/customer_screens/agriculture/AgriLogisticsScreen'));
const AgriReinsuranceScreen = lazy(() => import('./pages/customer_screens/agriculture/AgriReinsuranceScreen'));
const AgriSavingsCyclesScreen = lazy(() => import('./pages/customer_screens/agriculture/AgriSavingsCyclesScreen'));
const AgriEsgImpactScreen = lazy(() => import('./pages/customer_screens/agriculture/AgriEsgImpactScreen'));
const AnimalIdTraceabilityScreen = lazy(() => import('./pages/customer_screens/agriculture/AnimalIdTraceabilityScreen'));
const AreaYieldIndexInsuranceScreen = lazy(() => import('./pages/customer_screens/agriculture/AreaYieldIndexInsuranceScreen'));
const CbnAnchorBorrowersScreen = lazy(() => import('./pages/customer_screens/agriculture/CbnAnchorBorrowersScreen'));
const CooperativeCreditScoringScreen = lazy(() => import('./pages/customer_screens/agriculture/CooperativeCreditScoringScreen'));
const CooperativeFinancialsScreen = lazy(() => import('./pages/customer_screens/agriculture/CooperativeFinancialsScreen'));
const CooperativeManagementScreen = lazy(() => import('./pages/customer_screens/agriculture/CooperativeManagementScreen'));
const CooperativeMeetingsScreen = lazy(() => import('./pages/customer_screens/agriculture/CooperativeMeetingsScreen'));
const CropYieldPredictionScreen = lazy(() => import('./pages/customer_screens/agriculture/CropYieldPredictionScreen'));
const FarmBoundaryMappingScreen = lazy(() => import('./pages/customer_screens/agriculture/FarmBoundaryMappingScreen'));
const LivestockFinanceScreen = lazy(() => import('./pages/customer_screens/agriculture/LivestockFinanceScreen'));
const LivestockInsuranceScreen = lazy(() => import('./pages/customer_screens/agriculture/LivestockInsuranceScreen'));
const LivestockManagementScreen = lazy(() => import('./pages/customer_screens/agriculture/LivestockManagementScreen'));
const MultiPerilCropInsuranceScreen = lazy(() => import('./pages/customer_screens/agriculture/MultiPerilCropInsuranceScreen'));
const NirsalAgroGeocoopScreen = lazy(() => import('./pages/customer_screens/agriculture/NirsalAgroGeocoopScreen'));
const NirsalCreditGuaranteeScreen = lazy(() => import('./pages/customer_screens/agriculture/NirsalCreditGuaranteeScreen'));
const IslamicBankingDashboard = lazy(() => import('./pages/customer_screens/islamic_banking/IslamicBankingDashboard'));
const MurabahaScreen = lazy(() => import('./pages/customer_screens/islamic_banking/MurabahaScreen'));
const MusharakaScreen = lazy(() => import('./pages/customer_screens/islamic_banking/MusharakaScreen'));
const IjaraScreen = lazy(() => import('./pages/customer_screens/islamic_banking/IjaraScreen'));
const TakafulScreen = lazy(() => import('./pages/customer_screens/islamic_banking/TakafulScreen'));
const SukukScreen = lazy(() => import('./pages/customer_screens/islamic_banking/SukukScreen'));
const DisputeDetailScreen = lazy(() => import('./pages/customer_screens/disputes/DisputeDetailScreen'));
const MortgageCalculatorScreen = lazy(() => import('./pages/customer_screens/mortgage/MortgageCalculatorScreen'));
const CarbonFootprintScreen = lazy(() => import('./pages/customer_screens/carbon_credits/CarbonFootprintScreen'));
const CarbonProjectsScreen = lazy(() => import('./pages/customer_screens/carbon_credits/CarbonProjectsScreen'));
const CarbonTradesScreen = lazy(() => import('./pages/customer_screens/carbon_credits/CarbonTradesScreen'));
const LanguageSettingsScreen = lazy(() => import('./pages/customer_screens/settings/language_settings_screen'));
const AddAccountScreen = lazy(() => import('./pages/customer_screens/accounts/AddAccountScreen'));
const DeviceOrderScreen = lazy(() => import('./pages/customer_screens/agriculture/agtech/DeviceOrderScreen'));
const TransactionDetailScreen = lazy(() => import('./pages/customer_screens/transaction/transaction_detail_screen'));
const AllPoliciesScreen = lazy(() => import('./pages/customer_screens/insurance/AllPoliciesScreen'));
const MyPoliciesScreen = lazy(() => import('./pages/customer_screens/insurance/MyPoliciesScreen'));
const InsuranceClaimsScreen = lazy(() => import('./pages/customer_screens/insurance/InsuranceClaimsScreen'));
const InsurancePremiumPaymentsScreen = lazy(() => import('./pages/customer_screens/insurance/InsurancePremiumPaymentsScreen'));
const ApplyPolicyScreen = lazy(() => import('./pages/customer_screens/insurance/ApplyPolicyScreen'));
const SubmitClaimScreen = lazy(() => import('./pages/customer_screens/insurance/SubmitClaimScreen'));
const OnboardingAccountTypeScreen = lazy(() => import('./pages/onboarding/account_type_screen'));
const AddressVerificationScreen = lazy(() => import('./pages/onboarding/address_verification_screen'));
const BusinessDetailsScreen = lazy(() => import('./pages/onboarding/business_details_screen'));
const OnboardingCompletionScreen = lazy(() => import('./pages/onboarding/onboarding_completion_screen'));
const OnboardingStartScreen = lazy(() => import('./pages/onboarding/onboarding_start_screen'));
const SplashScreen = lazy(() => import('./pages/SplashScreen'));

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40, height: 40, margin: '0 auto 12px', borderRadius: '50%',
            border: '3px solid #e5e7eb', borderTopColor: '#2563eb',
            animation: 'rf-spin 0.8s linear infinite',
          }}
        />
        <style>{'@keyframes rf-spin { to { transform: rotate(360deg); } }'}</style>
        <span style={{ color: '#6b7280', fontSize: 14 }}>Loading…</span>
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  
  // Hide navigation and footer on auth and onboarding screens
  const isAuthOrOnboarding = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/login-otp',
    '/email-otp',
    '/onboarding-start',
    '/onboarding-account-type',
    '/business-details',
    '/onboarding-address',
    '/onboarding-face-verification',
    '/onboarding-completion',
    '/bvn-verification',
    '/create-pin',
  ].includes(location.pathname);

  return (
    <TenantInitializer>
      {!isAuthOrOnboarding && <Navigation />}
      <main className="min-h-[80vh] bg-gray-50 dark:bg-gray-900 pb-safe md:pb-0" style={{ paddingBottom: isAuthOrOnboarding ? 0 : undefined }}>
        <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="/" element={<SplashScreen />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login-otp" element={<LoginOtpScreen />} />
          <Route path="/register" element={<Register/>} />
          <Route path="/email-otp" element={<EmailOtpScreen />} />
          <Route path="/forgot-password" element={<ForgotPassword/>} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
          <Route path="/change-password" element={<ChangePasswordScreen />} />
          <Route path="/password-created" element={<PasswordCreatedScreen />} />

          {/* Onboarding Routes (public) */}
          <Route path="/kyc-complete" element={<KYCCompleteSuccessScreen />} />
          <Route path="/onboarding-start" element={<OnboardingStartScreen />} />
          <Route path="/onboarding-account-type" element={<OnboardingAccountTypeScreen />} />
          <Route path="/business-details" element={<BusinessDetailsScreen />} />
          <Route path="/onboarding-address" element={<AddressVerificationScreen />} />
          <Route path="/onboarding-face-verification" element={<FaceVerificationScreen />} />
          <Route path="/onboarding-completion" element={<OnboardingCompletionScreen />} />
          <Route path="/bvn-verification" element={<BvnVerificationScreen />} />
          <Route path="/create-pin" element={<CreatePinScreen />} />

          {/* Offline page (must be reachable without auth) */}
          <Route path="/offline" element={<OfflineScreen />} />

          {/* ── Protected routes — require authentication ── */}
          <Route element={<ProtectedRoute />}>
            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard/>} />

            {/* Transfers */}
            <Route path="/transfer" element={<Transfer/>} />
            <Route path="/bulk-transfer" element={<BulkTransferScreen />} />
            <Route path="/beneficiaries" element={<BeneficiariesScreen />} />
            <Route path="/deposit" element={<DepositScreen />} />

            {/* Cards */}
            <Route path="/cards" element={<CardScreen />} />
            <Route path="/qrcode" element={<QRCodeScreen />} />

            {/* Accounts */}
            <Route path="/accounts" element={<AccountsScreen />} />
            <Route path="/accounts/add" element={<AddAccountScreen />} />
            <Route path="/bank-details" element={<BankDetailsScreen/>} />
            <Route path="/complete-profile" element={<CompleteProfileScreen />} />

            {/* KYC (authenticated tier upgrades) */}
            <Route path="/kyc-address" element={<AddressVerificationScreen />} />
            <Route path="/kyc-face-verification" element={<FaceVerificationScreen />} />
            <Route path="/face-verification" element={<FaceVerificationScreen />} />
            <Route path="/face-scan" element={<FaceScanningScreen />} />
            <Route path="/face-verification-success" element={<FaceVerificationSuccessScreen />} />

            {/* PIN (post-login) */}
            <Route path="/input-pin" element={<InputPinScreen />} />
            <Route path="/forgot-pin" element={<ForgotPinScreen />} />
            <Route path="/pin-created" element={<PinCreatedScreen />} />

            {/* Loans */}
            <Route path="/loan-application" element={<LoansApplicationScreen/>} />
            <Route path="/active-loans" element={<LoansListScreen />} />
            <Route path="/loans" element={<LoansListScreen />} />
            <Route path="/loan-details/:id" element={<LoanDetailsScreen />} />

            {/* LPO Routes */}
            <Route path="/lpo-application" element={<LPOApplicationScreen/>} />
            <Route path="/active-lpos" element={<LPOListScreen />} />
            <Route path="/lpo" element={<LPOListScreen />} />
            <Route path="/lpo-details/:id" element={<LPODetailsScreen />} />

            {/* Savings */}
            <Route path="/savings" element={<SavingsListScreen />} />
            <Route path="/savings/create" element={<CreateSavingsScreen />} />
            <Route path="/savings/:id" element={<SavingsDetailsScreen />} />

            {/* Investments */}
            <Route path="/investments" element={<InvestmentsScreen />} />

            {/* Bills */}
            <Route path="/bills" element={<BillPaymentScreen />} />
            {/* <Route path="/bills" element={<BillsScreen />} /> */}

            {/* Notifications */}
            <Route path="/notifications" element={<NotificationScreen/>} />

            {/* Insurance */}
            <Route path="/insurance" element={<InsuranceScreen />} />
            <Route path="/insurance/all-policies" element={<AllPoliciesScreen />} />
            <Route path="/insurance/my-policies" element={<MyPoliciesScreen />} />
            <Route path="/insurance/claims" element={<InsuranceClaimsScreen />} />
            <Route path="/insurance/premium-payments" element={<InsurancePremiumPaymentsScreen />} />
            <Route path="/insurance/apply" element={<ApplyPolicyScreen />} />
            <Route path="/insurance/submit-claim" element={<SubmitClaimScreen />} />

            {/* Rewards */}
            <Route path="/rewards" element={<RewardsScreen />} />

            {/* Carbon Credits */}
            <Route path="/carbon-credits" element={<CarbonCreditsScreen />} />
            <Route path="/carbon-credits/footprints" element={<CarbonFootprintScreen />} />
            <Route path="/carbon-credits/projects" element={<CarbonProjectsScreen />} />
            <Route path="/carbon-credits/trades" element={<CarbonTradesScreen />} />

            {/* Disputes */}
            <Route path="/disputes" element={<DisputesListScreen />} />
            <Route path="/disputes/:id" element={<DisputeDetailScreen />} />
            <Route path="/create-dispute" element={<CreateDisputeScreen />} />

            {/* Scheduled Payments */}
            <Route path="/scheduled-payments" element={<ScheduledPaymentsScreen />} />

            {/* Escrow */}
            <Route path="/escrow" element={<EscrowListScreen />} />
            <Route path="/escrow/create" element={<CreateEscrowScreen />} />
            <Route path="/escrow/:id" element={<EscrowDetailScreen />} />

            {/* Mortgage */}
            <Route path="/mortgage" element={<MortgageListScreen />} />
            <Route path="/mortgage-details/:id" element={<MortgageDetailScreen />} />
            <Route path="/mortgage/apply" element={<MortgageApplicationScreen />} />
            <Route path="/mortgage/calculator" element={<MortgageCalculatorScreen />} />

            {/* BNPL */}
            <Route path="/bnpl" element={<BNPLListScreen />} />
            <Route path="/bnpl/apply" element={<BNPLApplyScreen />} />
            <Route path="/bnpl/details" element={<BNPLDetailsScreen />} />
            {/* Equipment Leasing */}
            <Route path="/equipment-leasing/apply" element={<EquipmentLeasingApplyScreen />} />
            {/* Project Finance */}
            <Route path="/project-finance/apply" element={<ProjectFinanceApplyScreen />} />

            {/* Open Banking */}
            <Route path="/settings/open-banking" element={<OpenBankingConsentScreen />} />

            {/* Education Loans */}
            <Route path="/education-loans" element={<EducationLoanListScreen />} />
            <Route path="/education-loans/apply" element={<EducationLoanApplicationScreen />} />
            <Route path="/education-loan-details/:id" element={<EducationLoanDetailScreen />} />
            <Route path="/education-loan-update" element={<EducationLoanUpdateScreen />} />

            {/* Agriculture */}
            <Route path="/agriculture" element={<AgricultureDashboardScreen />} />
            <Route path="/agriculture/farmers" element={<FarmersScreen />} />
            <Route path="/agriculture/farmers/register" element={<FarmerRegistrationScreen />} />
            <Route path="/agriculture/farms" element={<FarmsListScreen />} />
            <Route path="/agriculture/farms/register" element={<FarmRegistrationScreen />} />
            <Route path="/agriculture/agtech" element={<AgTechScreen />} />
            <Route path="/agriculture/agtech/order" element={<DeviceOrderScreen />} />
            <Route path="/agriculture/loans" element={<AgriLoansScreen />} />
            <Route path="/agriculture/risk-alerts" element={<RiskAlertsScreen />} />
            <Route path="/agriculture/value-chain" element={<ValueChainScreen />} />
            <Route path="/agriculture/regulatory" element={<RegulatoryScreen />} />
            <Route path="/agriculture/proactive-risk" element={<ProactiveRiskScreen />} />
            <Route path="/agriculture/inclusive-access" element={<InclusiveAccessScreen />} />
            <Route path="/agriculture/weather" element={<WeatherScreen />} />
            <Route path="/agriculture/products" element={<FarmerProductsScreen />} />
            <Route path="/agriculture/impact" element={<FarmerImpactScreen />} />
            <Route path="/agriculture/insurance" element={<AgricultureInsuranceClientScreen />} />
            <Route path="/agriculture/programs" element={<GovernmentProgramsScreen />} />
            <Route path="/agriculture/evoucher" element={<AgriEvoucherScreen />} />
            <Route path="/agriculture/input-marketplace" element={<AgriInputMarketplaceScreen />} />
            <Route path="/agriculture/iot-sensors" element={<AgriIotSensorScreen />} />
            <Route path="/agriculture/logistics" element={<AgriLogisticsScreen />} />
            <Route path="/agriculture/reinsurance" element={<AgriReinsuranceScreen />} />
            <Route path="/agriculture/savings-cycles" element={<AgriSavingsCyclesScreen />} />
            <Route path="/agriculture/esg-impact" element={<AgriEsgImpactScreen />} />
            <Route path="/agriculture/animal-id" element={<AnimalIdTraceabilityScreen />} />
            <Route path="/agriculture/area-yield-insurance" element={<AreaYieldIndexInsuranceScreen />} />
            <Route path="/agriculture/cbn-anchor-borrowers" element={<CbnAnchorBorrowersScreen />} />
            <Route path="/agriculture/cooperative-credit-scoring" element={<CooperativeCreditScoringScreen />} />
            <Route path="/agriculture/cooperative-financials" element={<CooperativeFinancialsScreen />} />
            <Route path="/agriculture/cooperative-management" element={<CooperativeManagementScreen />} />
            <Route path="/agriculture/cooperative-meetings" element={<CooperativeMeetingsScreen />} />
            <Route path="/agriculture/crop-yield-prediction" element={<CropYieldPredictionScreen />} />
            <Route path="/agriculture/farm-boundary-mapping" element={<FarmBoundaryMappingScreen />} />
            <Route path="/agriculture/livestock-finance" element={<LivestockFinanceScreen />} />
            <Route path="/agriculture/livestock-insurance" element={<LivestockInsuranceScreen />} />
            <Route path="/agriculture/livestock-management" element={<LivestockManagementScreen />} />
            <Route path="/agriculture/multi-peril-insurance" element={<MultiPerilCropInsuranceScreen />} />
            <Route path="/agriculture/nirsal-geocoop" element={<NirsalAgroGeocoopScreen />} />
            <Route path="/agriculture/nirsal-credit-guarantee" element={<NirsalCreditGuaranteeScreen />} />

            {/* Trade Finance */}
            <Route path="/trade-finance" element={<TradeFinanceDashboardScreen />} />
            <Route path="/trade-finance/lc" element={<LCListScreen />} />
            <Route path="/trade-finance/lc/apply" element={<LCApplyScreen />} />
            <Route path="/trade-finance/lc/details" element={<LCDetailsScreen />} />
            <Route path="/trade-finance/bank-guarantees" element={<BankGuaranteeListScreen />} />
            <Route path="/trade-finance/bank-guarantees/apply" element={<BankGuaranteeApplyScreen />} />
            <Route path="/trade-finance/factoring" element={<FactoringListScreen />} />
            <Route path="/trade-finance/factoring/apply" element={<FactoringApplyScreen />} />

            {/* Diaspora & International */}
            <Route path="/diaspora-banking" element={<DiasporaBankingScreen />} />
            <Route path="/remittance" element={<RemittanceScreen />} />

            {/* CBDC */}
            <Route path="/cbdc" element={<ENairaCBDCScreen />} />

            {/* Wealth Management */}
            <Route path="/wealth-management" element={<WealthManagementScreen />} />

            {/* FX */}
            <Route path="/fx" element={<FXScreen />} />

            {/* Pensions */}
            <Route path="/pensions" element={<PensionsScreen />} />

            {/* Cheques */}
            <Route path="/cheques" element={<ChequesScreen />} />

            {/* Voice Banking */}
            <Route path="/voice-banking" element={<VoiceAssistantScreen />} />
            <Route path="/voice-asr" element={<VoiceASRNigerianScreen />} />
            <Route path="/voice-tts" element={<VoiceTTSNigerianScreen />} />
            <Route path="/voice-biometric" element={<VoiceBiometricAuthScreen />} />
            <Route path="/voice-ivr" element={<VoiceIVRMenuScreen />} />
            <Route path="/voice-nlu" element={<VoiceNLUBankingScreen />} />
            <Route path="/voice-gateway" element={<VoiceBankingGatewayScreen />} />
            <Route path="/voice-escalation" element={<VoiceAgentEscalationScreen />} />

            {/* Islamic Banking */}
            <Route path="/islamic-banking" element={<IslamicBankingDashboard />} />
            <Route path="/islamic-banking/murabaha" element={<MurabahaScreen />} />
            <Route path="/islamic-banking/musharaka" element={<MusharakaScreen />} />
            <Route path="/islamic-banking/ijara" element={<IjaraScreen />} />
            <Route path="/islamic-banking/takaful" element={<TakafulScreen />} />
            <Route path="/islamic-banking/sukuk" element={<SukukScreen />} />

            {/* Esusu (Rotating Savings) */}
            <Route path="/esusu" element={<EsusuScreen />} />

            {/* Virtual Account Numbers */}
            <Route path="/van" element={<VANManagementScreen />} />

            {/* Transactions */}
            <Route path="/transaction-history" element={<TransactionHistory />} />
            <Route path="/transaction/:id" element={<TransactionDetailScreen />} />
            <Route path="/receipt" element={<ReceiptScreen />} />
            <Route path="/bank-statement" element={<BankStatementScreen />} />

            {/* More Actions */}
            <Route path="/more-actions" element={<MoreActionsScreen />} />

            {/* Settings */}
            <Route path="/settings" element={<Settings/>} />
            <Route path="/settings/language" element={<LanguageSettingsScreen />} />
            <Route path="/settings/biometric" element={<BiometricEnrollmentScreen />} />
            <Route path="/biometric-enrollment" element={<BiometricEnrollmentScreen />} />
            <Route path="/support" element={<SupportScreen />} />
            <Route path="/faq" element={<FaqScreen />} />
            <Route path="/network-monitor" element={<NetworkMonitorScreen />} />
          </Route>
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      {!isAuthOrOnboarding && <MobileBottomNav />}
      {!isAuthOrOnboarding && <Footer />}
      
      {/* Sync Status Indicator */}
      {!isAuthOrOnboarding && <SyncStatusIndicator />}
      
      {/* Tenant Indicator - shows current tenant */}
      <TenantIndicator />
      
      {/* Tenant Switcher - toggle with Ctrl+Shift+T */}
      <TenantSwitcher />
    </TenantInitializer>
  );
}



export default App;