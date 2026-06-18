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
import ChangePasswordScreen from './pages/auth/change_password_screen';
import ForgotPassword from './pages/auth/ForgotPassaword';
import ResetPasswordScreen from './pages/auth/reset_password_screen';
import Login from './pages/auth/Login';
import PasswordCreatedScreen from './pages/auth/password_created_screen';
import Register from './pages/auth/Register';
import BankDetailsScreen from './pages/customer_screens/account/bank_details';
import BvnVerificationScreen from './pages/customer_screens/account/bvn_verification_screen';
import CompleteProfileScreen from './pages/customer_screens/account/complete_profile_screen';
import AccountsScreen from './pages/customer_screens/accounts/AccountsScreen';
import AgricultureDashboardScreen from './pages/customer_screens/agriculture/AgricultureDashboardScreen';
import FarmersScreen from './pages/customer_screens/agriculture/farmers/FarmersScreen';
import FarmsListScreen from './pages/customer_screens/agriculture/farms/FarmsListScreen';
import AgTechScreen from './pages/customer_screens/agriculture/agtech/AgTechScreen';
import AgriLoansScreen from './pages/customer_screens/agriculture/loans/AgriLoansScreen';
import FarmerRegistrationScreen from './pages/customer_screens/agriculture/FarmerRegistrationScreen';
import FarmRegistrationScreen from './pages/customer_screens/agriculture/FarmRegistrationScreen';
import InclusiveAccessScreen from './pages/customer_screens/agriculture/InclusiveAccessScreen';
import ProactiveRiskScreen from './pages/customer_screens/agriculture/ProactiveRiskScreen';
import RegulatoryScreen from './pages/customer_screens/agriculture/RegulatoryScreen';
import RiskAlertsScreen from './pages/customer_screens/agriculture/RiskAlertsScreen';
import ValueChainScreen from './pages/customer_screens/agriculture/ValueChainScreen';
import WeatherScreen from './pages/customer_screens/agriculture/WeatherScreen';
import FarmerProductsScreen from './pages/customer_screens/agriculture/FarmerProductsScreen';
import FarmerImpactScreen from './pages/customer_screens/agriculture/FarmerImpactScreen';
import AgricultureInsuranceClientScreen from './pages/customer_screens/agriculture/AgricultureInsuranceClientScreen';
import GovernmentProgramsScreen from './pages/customer_screens/agriculture/GovernmentProgramsScreen';
import CarbonCreditsScreen from './pages/customer_screens/carbon_credits/carbon_credits_screen';
import CardScreen from './pages/customer_screens/cards/card_screen';
import Dashboard from './pages/customer_screens/dashboard/Dashboard';
import DepositScreen from './pages/customer_screens/deposit/deposit_screen';
import CreateDisputeScreen from './pages/customer_screens/disputes/CreateDisputeScreen';
import DisputesListScreen from './pages/customer_screens/disputes/DisputesListScreen';
import BNPLApplyScreen from './pages/customer_screens/bnpl/BNPLApplyScreen';
import BNPLListScreen from './pages/customer_screens/bnpl/BNPLListScreen';
import OpenBankingConsentScreen from './pages/customer_screens/open_banking/OpenBankingConsentScreen';
import EducationLoanApplicationScreen from './pages/customer_screens/education/EducationLoanApplicationScreen';
import EducationLoanListScreen from './pages/customer_screens/education/EducationLoanListScreen';
import EducationLoanDetailScreen from './pages/customer_screens/education/EducationLoanDetailScreen';
import EscrowListScreen from './pages/customer_screens/escrow/EscrowListScreen';
import EscrowDetailScreen from './pages/customer_screens/escrow/EscrowDetailScreen';
import CreateEscrowScreen from './pages/customer_screens/escrow/CreateEscrowScreen';
import EsusuScreen from './pages/customer_screens/esusu/EsusuScreen';
import FaceScanningScreen from './pages/customer_screens/face_verification/face_scanning_screen';
import FaceVerificationScreen from './pages/customer_screens/face_verification/face_verification_screen';
import FaceVerificationSuccessScreen from './pages/customer_screens/face_verification/face_verification_success';
import InsuranceScreen from './pages/customer_screens/insurance/insurance_screen';
import LoanDetailsScreen from './pages/customer_screens/loans/loan_details_screen';
import LoansApplicationScreen from './pages/customer_screens/loans/loans_application_screen';
import LoansListScreen from './pages/customer_screens/loans/LoansListScreen';
import ProjectFinanceApplyScreen from './pages/customer_screens/loans/ProjectFinanceApplyScreen';
import EquipmentLeasingApplyScreen from './pages/customer_screens/agriculture/EquipmentLeasingApplyScreen';
import LPOListScreen from './pages/customer_screens/lpo/LPOListScreen';
import LPOApplicationScreen from './pages/customer_screens/lpos/lpo_application_screen';
import LPODetailsScreen from './pages/customer_screens/lpos/lpo_details_screen';
import MoreActionsScreen from './pages/customer_screens/more_actions/MoreActionsScreen';
import MortgageApplicationScreen from './pages/customer_screens/mortgage/MortgageApplicationScreen';
import MortgageDetailScreen from './pages/customer_screens/mortgage/MortgageDetailScreen';
import MortgageListScreen from './pages/customer_screens/mortgage/MortgageListScreen';
import NotificationScreen from './pages/customer_screens/notification/notification_screen';
import EmailOtpScreen from './pages/customer_screens/otp/email_otp';
import LoginOtpScreen from './pages/customer_screens/otp/login_otp';
import CreatePinScreen from './pages/customer_screens/pin/create_pin';
import ForgotPinScreen from './pages/customer_screens/pin/forgot_pin';
import InputPinScreen from './pages/customer_screens/pin/input_pin';
import PinCreatedScreen from './pages/customer_screens/pin/pin_created';
import QRCodeScreen from './pages/customer_screens/qrcode/qrcode_screen';
import RewardsScreen from './pages/customer_screens/rewards/rewards_screen';
import CreateSavingsScreen from './pages/customer_screens/savings/CreateSavingsScreen';
import SavingsDetailsScreen from './pages/customer_screens/savings/SavingsDetailsScreen';
import SavingsListScreen from './pages/customer_screens/savings/SavingsListScreen';
import ScheduledPaymentsScreen from './pages/customer_screens/scheduled_payments/ScheduledPaymentsScreen';
import FaqScreen from './pages/customer_screens/settings/faq_screen';
import NetworkMonitorScreen from './pages/customer_screens/settings/network_monitor_screen';
import Settings from './pages/customer_screens/settings/settings_screen';
import SupportScreen from './pages/customer_screens/settings/support_screen';
import BankStatementScreen from './pages/customer_screens/transaction/bank_statement_screen';
import ReceiptScreen from './pages/customer_screens/transaction/receipt_screen';
import TransactionHistory from './pages/customer_screens/transaction/transaction_history';
import BeneficiariesScreen from './pages/customer_screens/transfers/beneficiaries_screen';
import Transfer from './pages/customer_screens/transfers/transfer_screen';
import BulkTransferScreen from './pages/customer_screens/transfers/bulk_transfer_screen';
import VANManagementScreen from './pages/customer_screens/van/VANManagementScreen';
import FXScreen from './pages/customer_screens/fx/FXScreen';
import PensionsScreen from './pages/customer_screens/pensions/PensionsScreen';
import InvestmentsScreen from './pages/customer_screens/investments/InvestmentsScreen';
import ChequesScreen from './pages/customer_screens/cheques/ChequesScreen';
import BillPaymentScreen from './pages/customer_screens/bills/bill_payment_screen';
import VoiceAssistantScreen from './pages/customer_screens/voice_banking/VoiceAssistantScreen';
import VoiceASRNigerianScreen from './pages/customer_screens/voice_banking/VoiceASRNigerianScreen';
import VoiceTTSNigerianScreen from './pages/customer_screens/voice_banking/VoiceTTSNigerianScreen';
import VoiceBiometricAuthScreen from './pages/customer_screens/voice_banking/VoiceBiometricAuthScreen';
import VoiceIVRMenuScreen from './pages/customer_screens/voice_banking/VoiceIVRMenuScreen';
import VoiceNLUBankingScreen from './pages/customer_screens/voice_banking/VoiceNLUBankingScreen';
import VoiceBankingGatewayScreen from './pages/customer_screens/voice_banking/VoiceBankingGatewayScreen';
import VoiceAgentEscalationScreen from './pages/customer_screens/voice_banking/VoiceAgentEscalationScreen';
import TradeFinanceDashboardScreen from './pages/customer_screens/trade_finance/TradeFinanceDashboardScreen';
import LCListScreen from './pages/customer_screens/trade_finance/LCListScreen';
import LCApplyScreen from './pages/customer_screens/trade_finance/LCApplyScreen';
import LCDetailsScreen from './pages/customer_screens/trade_finance/LCDetailsScreen';
import BankGuaranteeListScreen from './pages/customer_screens/trade_finance/BankGuaranteeListScreen';
import BankGuaranteeApplyScreen from './pages/customer_screens/trade_finance/BankGuaranteeApplyScreen';
import FactoringListScreen from './pages/customer_screens/trade_finance/FactoringListScreen';
import FactoringApplyScreen from './pages/customer_screens/trade_finance/FactoringApplyScreen';
import BiometricEnrollmentScreen from './pages/customer_screens/biometric/BiometricEnrollmentScreen';
import BNPLDetailsScreen from './pages/customer_screens/bnpl/BNPLDetailsScreen';
import EducationLoanUpdateScreen from './pages/customer_screens/education/EducationLoanUpdateScreen';
import KYCCompleteSuccessScreen from './pages/onboarding/KYCCompleteSuccessScreen';
import DiasporaBankingScreen from './pages/customer_screens/diaspora/DiasporaBankingScreen';
import ENairaCBDCScreen from './pages/customer_screens/cbdc/ENairaCBDCScreen';
import WealthManagementScreen from './pages/customer_screens/wealth/WealthManagementScreen';
import RemittanceScreen from './pages/customer_screens/remittance/RemittanceScreen';
import AgriEvoucherScreen from './pages/customer_screens/agriculture/AgriEvoucherScreen';
import AgriInputMarketplaceScreen from './pages/customer_screens/agriculture/AgriInputMarketplaceScreen';
import AgriIotSensorScreen from './pages/customer_screens/agriculture/AgriIotSensorScreen';
import AgriLogisticsScreen from './pages/customer_screens/agriculture/AgriLogisticsScreen';
import AgriReinsuranceScreen from './pages/customer_screens/agriculture/AgriReinsuranceScreen';
import AgriSavingsCyclesScreen from './pages/customer_screens/agriculture/AgriSavingsCyclesScreen';
import AgriEsgImpactScreen from './pages/customer_screens/agriculture/AgriEsgImpactScreen';
import AnimalIdTraceabilityScreen from './pages/customer_screens/agriculture/AnimalIdTraceabilityScreen';
import AreaYieldIndexInsuranceScreen from './pages/customer_screens/agriculture/AreaYieldIndexInsuranceScreen';
import CbnAnchorBorrowersScreen from './pages/customer_screens/agriculture/CbnAnchorBorrowersScreen';
import CooperativeCreditScoringScreen from './pages/customer_screens/agriculture/CooperativeCreditScoringScreen';
import CooperativeFinancialsScreen from './pages/customer_screens/agriculture/CooperativeFinancialsScreen';
import CooperativeManagementScreen from './pages/customer_screens/agriculture/CooperativeManagementScreen';
import CooperativeMeetingsScreen from './pages/customer_screens/agriculture/CooperativeMeetingsScreen';
import CropYieldPredictionScreen from './pages/customer_screens/agriculture/CropYieldPredictionScreen';
import FarmBoundaryMappingScreen from './pages/customer_screens/agriculture/FarmBoundaryMappingScreen';
import LivestockFinanceScreen from './pages/customer_screens/agriculture/LivestockFinanceScreen';
import LivestockInsuranceScreen from './pages/customer_screens/agriculture/LivestockInsuranceScreen';
import LivestockManagementScreen from './pages/customer_screens/agriculture/LivestockManagementScreen';
import MultiPerilCropInsuranceScreen from './pages/customer_screens/agriculture/MultiPerilCropInsuranceScreen';
import NirsalAgroGeocoopScreen from './pages/customer_screens/agriculture/NirsalAgroGeocoopScreen';
import NirsalCreditGuaranteeScreen from './pages/customer_screens/agriculture/NirsalCreditGuaranteeScreen';
import IslamicBankingDashboard from './pages/customer_screens/islamic_banking/IslamicBankingDashboard';
import MurabahaScreen from './pages/customer_screens/islamic_banking/MurabahaScreen';
import MusharakaScreen from './pages/customer_screens/islamic_banking/MusharakaScreen';
import IjaraScreen from './pages/customer_screens/islamic_banking/IjaraScreen';
import TakafulScreen from './pages/customer_screens/islamic_banking/TakafulScreen';
import SukukScreen from './pages/customer_screens/islamic_banking/SukukScreen';
import DisputeDetailScreen from './pages/customer_screens/disputes/DisputeDetailScreen';
import MortgageCalculatorScreen from './pages/customer_screens/mortgage/MortgageCalculatorScreen';
import CarbonFootprintScreen from './pages/customer_screens/carbon_credits/CarbonFootprintScreen';
import CarbonProjectsScreen from './pages/customer_screens/carbon_credits/CarbonProjectsScreen';
import CarbonTradesScreen from './pages/customer_screens/carbon_credits/CarbonTradesScreen';
import LanguageSettingsScreen from './pages/customer_screens/settings/language_settings_screen';
import AddAccountScreen from './pages/customer_screens/accounts/AddAccountScreen';
import DeviceOrderScreen from './pages/customer_screens/agriculture/agtech/DeviceOrderScreen';
import TransactionDetailScreen from './pages/customer_screens/transaction/transaction_detail_screen';
import AllPoliciesScreen from './pages/customer_screens/insurance/AllPoliciesScreen';
import MyPoliciesScreen from './pages/customer_screens/insurance/MyPoliciesScreen';
import InsuranceClaimsScreen from './pages/customer_screens/insurance/InsuranceClaimsScreen';
import InsurancePremiumPaymentsScreen from './pages/customer_screens/insurance/InsurancePremiumPaymentsScreen';
import ApplyPolicyScreen from './pages/customer_screens/insurance/ApplyPolicyScreen';
import SubmitClaimScreen from './pages/customer_screens/insurance/SubmitClaimScreen';
import OnboardingAccountTypeScreen from './pages/onboarding/account_type_screen';
import AddressVerificationScreen from './pages/onboarding/address_verification_screen';
import BusinessDetailsScreen from './pages/onboarding/business_details_screen';
import OnboardingCompletionScreen from './pages/onboarding/onboarding_completion_screen';
import OnboardingStartScreen from './pages/onboarding/onboarding_start_screen';
import SplashScreen from './pages/SplashScreen';

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