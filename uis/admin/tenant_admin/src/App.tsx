import { lazy, useEffect, useState, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import { authService } from "./services/auth/authService";
const ErrorBoundary = lazy(() => import("./components/ErrorBoundary"));
const Toaster = lazy(() =>
  import("./components/ui/sonner").then((m) => ({ default: m.Toaster }))
);
const TooltipProvider = lazy(() =>
  import("./components/ui/tooltip").then((m) => ({ default: m.TooltipProvider }))
);
const ProgressProvider = lazy(() =>
  import("./contexts/ProgressContext").then((m) => ({ default: m.ProgressProvider }))
);
const TenantBrandingProvider = lazy(() =>
  import("./contexts/TenantBrandingContext").then((m) => ({ default: m.TenantBrandingProvider }))
);
const ThemeProvider = lazy(() =>
  import("./contexts/ThemeContext").then((m) => ({ default: m.ThemeProvider }))
);

// UI components that are used inline — kept as static imports
const KYCVerificationDialog = lazy(() =>
  import("./components/KYCVerificationDialog").then((m) => ({ default: m.KYCVerificationDialog }))
);

// Pages — lazy loaded
const AgentBanking = lazy(() => import("./pages/AgentBanking"));
const AgricultureAgTech = lazy(() => import("./pages/AgricultureAgTech"));
const AgricultureAnalytics = lazy(() => import("./pages/AgricultureAnalytics"));
const AgricultureBanking = lazy(() => import("./pages/AgricultureBanking"));
const AgricultureFarmers = lazy(() => import("./pages/AgricultureFarmers"));
const AgricultureFarms = lazy(() => import("./pages/AgricultureFarms"));
const AgricultureInsurance = lazy(() => import("./pages/AgricultureInsurance"));
const AgricultureLoans = lazy(() => import("./pages/AgricultureLoans"));
const AgriculturePartners = lazy(() => import("./pages/AgriculturePartners"));
const AgricultureRegulatory = lazy(() => import("./pages/AgricultureRegulatory"));
const AgricultureRisk = lazy(() => import("./pages/AgricultureRisk"));
const AgricultureValueChain = lazy(() => import("./pages/AgricultureValueChain"));
const AlertRules = lazy(() => import("./pages/AlertRules"));
const AlertSettings = lazy(() => import("./pages/AlertSettings"));
const Alerts = lazy(() => import("./pages/Alerts"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const BankManagement = lazy(() => import("./pages/BankManagement"));
const BankOnboarding = lazy(() => import("./pages/BankOnboarding"));
const Billing = lazy(() => import("./pages/Billing"));
const BillingLedger = lazy(() => import("./pages/BillingLedger"));
const BusinessManagement = lazy(() => import("./pages/BusinessManagement"));
const CardDashboard = lazy(() => import("./pages/CardDashboard"));
const CommunicationHub = lazy(() => import("./pages/CommunicationHub"));
const Curriculum = lazy(() => import("./pages/Curriculum"));
const CustomerFeedback = lazy(() => import("./pages/CustomerFeedback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RelationshipManager = lazy(() => import("./pages/RelationshipManager"));
const DepositScreen = lazy(() => import("./pages/DepositScreen"));
const DisputeScreen = lazy(() => import("./pages/DisputeScreen"));
const Disputes = lazy(() => import("./pages/Disputes"));
const EducationBanking = lazy(() => import("./pages/EducationBanking"));
const EducationLoanApplicationScreen = lazy(() => import("./pages/EducationLoanApplicationScreen"));
const EscrowManagement = lazy(() => import("./pages/EscrowManagement"));
const EsusuManagement = lazy(() => import("./pages/EsusuManagement"));
const FeatureFlags = lazy(() => import("./pages/FeatureFlags"));
const GroupLending = lazy(() => import("./pages/GroupLending"));
const Home = lazy(() => import("./pages/Home"));
const Infrastructure = lazy(() => import("./pages/Infrastructure"));
const Institutions = lazy(() => import("./pages/Institutions"));
const InsurancePage = lazy(() => import("./pages/Insurance"));
const IslamicBanking = lazy(() => import("./pages/IslamicBanking"));
const IslamicBankingApplicationScreen = lazy(() => import("./pages/IslamicBankingApplicationScreen"));
const KYC = lazy(() => import("./pages/KYC"));
const LPO = lazy(() => import("./pages/LPO"));
const Labs = lazy(() => import("./pages/Labs"));
const LoanApplicationScreen = lazy(() => import("./pages/LoanApplicationScreen"));
const LoanPaymentScreen = lazy(() => import("./pages/LoanPaymentScreen"));
const Loans = lazy(() => import("./pages/Loans"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Login = lazy(() => import("./pages/Login"));
const LpoApplicationScreen = lazy(() => import("./pages/LpoApplicationScreen"));
const LpoPaymentScreen = lazy(() => import("./pages/LpoPaymentScreen"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const MortgageApplicationScreen = lazy(() => import("./pages/MortgageApplicationScreen"));
const MortgageBanking = lazy(() => import("./pages/MortgageBanking"));
const MyAccess = lazy(() => import("./pages/MyAccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
const QuickReference = lazy(() => import("./pages/QuickReference"));
const RegulatoryReporting = lazy(() => import("./pages/RegulatoryReporting"));
const Resources = lazy(() => import("./pages/Resources"));
const Savings = lazy(() => import("./pages/Savings"));
const TellerManagement = lazy(() => import("./pages/TellerManagement"));
const TellerOperations = lazy(() => import("./pages/TellerOperations"));
const TemporalAccess = lazy(() => import("./pages/TemporalAccess"));
const TenantManagement = lazy(() => import("./pages/TenantManagement"));
const Transactions = lazy(() => import("./pages/Transactions"));
const TransferScreen = lazy(() => import("./pages/TransferScreen"));
const UsageAnalytics = lazy(() => import("./pages/UsageAnalytics"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const VirtualAccountManagement = lazy(() => import("./pages/VirtualAccountManagement"));

// Admin pages
const AdminManagement = lazy(() => import("./pages/admin/admins"));
const AdminAnalytics = lazy(() => import("./pages/admin/analytics"));
const AdminCards = lazy(() => import("./pages/admin/cards"));

// Chart of accounts
const ChartOfAccountsPage = lazy(() => import("./pages/chart-of-accounts/ChartOfAccountsPage"));

// Role dashboards
const AuditorDashboard = lazy(() => import("./pages/dashboard/AuditorDashboard"));
const BankAdminDashboard = lazy(() => import("./pages/dashboard/BankAdminDashboard"));
const ComplianceOfficerDashboard = lazy(() => import("./pages/dashboard/ComplianceOfficerDashboard"));
const CustomerSupportDashboard = lazy(() => import("./pages/dashboard/CustomerSupportDashboard"));
const FinanceAdminDashboard = lazy(() => import("./pages/dashboard/FinanceAdminDashboard"));
const LoanOfficerDashboard = lazy(() => import("./pages/dashboard/LoanOfficerDashboard"));
const OperationsOfficerDashboard = lazy(() => import("./pages/dashboard/OperationsOfficerDashboard"));
const RelationshipManagerDashboard = lazy(() => import("./pages/dashboard/RelationshipManagerDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/dashboard/SuperAdminDashboard"));
const TechnicalAdminDashboard = lazy(() => import("./pages/dashboard/TechnicalAdminDashboard"));
const TreasuryManagerDashboard = lazy(() => import("./pages/dashboard/TreasuryManagerDashboard"));
const VaultManagerDashboard = lazy(() => import("./pages/dashboard/VaultManagerDashboard"));
const Sidebar = lazy(() => import("./components/Sidebar"));

// Workspace pages
const AIFraudDetectionWorkspace = lazy(() => import("./pages/AIFraudDetectionWorkspace"));
const AMLCaseManagerWorkspace = lazy(() => import("./pages/AMLCaseManagerWorkspace"));
const AMLComplianceDashboardWorkspace = lazy(() => import("./pages/AMLComplianceDashboardWorkspace"));
const AMLRegulatoryReportingWorkspace = lazy(() => import("./pages/AMLRegulatoryReportingWorkspace"));
const AMLRiskScoringWorkspace = lazy(() => import("./pages/AMLRiskScoringWorkspace"));
const AMLTrainingTrackerWorkspace = lazy(() => import("./pages/AMLTrainingTrackerWorkspace"));
const ATMManagementWorkspace = lazy(() => import("./pages/ATMManagementWorkspace"));
const AccountOpeningWorkspace = lazy(() => import("./pages/AccountOpeningWorkspace"));
const AccountStatementsWorkspace = lazy(() => import("./pages/AccountStatementsWorkspace"));
const AccountingRulesWorkspace = lazy(() => import("./pages/AccountingRulesWorkspace"));
const AcgsfGuaranteeWorkspace = lazy(() => import("./pages/AcgsfGuaranteeWorkspace"));
const AddressVerificationWorkspace = lazy(() => import("./pages/AddressVerificationWorkspace"));
const AdverseMediaScannerWorkspace = lazy(() => import("./pages/AdverseMediaScannerWorkspace"));
const AdverseMediaWorkspace = lazy(() => import("./pages/AdverseMediaWorkspace"));
const AgentFarmerOnboardingWorkspace = lazy(() => import("./pages/AgentFarmerOnboardingWorkspace"));
const AgentKYCCaptureWorkspace = lazy(() => import("./pages/AgentKYCCaptureWorkspace"));
const AgentPerformanceWorkspace = lazy(() => import("./pages/AgentPerformanceWorkspace"));
const AggregationCenterWorkspace = lazy(() => import("./pages/AggregationCenterWorkspace"));
const AgriEsgImpactWorkspace = lazy(() => import("./pages/AgriEsgImpactWorkspace"));
const AgriEvoucherWorkspace = lazy(() => import("./pages/AgriEvoucherWorkspace"));
const AgriInputMarketplaceWorkspace = lazy(() => import("./pages/AgriInputMarketplaceWorkspace"));
const AgriIotSensorWorkspace = lazy(() => import("./pages/AgriIotSensorWorkspace"));
const AgriLogisticsWorkspace = lazy(() => import("./pages/AgriLogisticsWorkspace"));
const AgriReinsuranceWorkspace = lazy(() => import("./pages/AgriReinsuranceWorkspace"));
const AgriSavingsCyclesWorkspace = lazy(() => import("./pages/AgriSavingsCyclesWorkspace"));
const AgriculturalInsuranceWorkspace = lazy(() => import("./pages/AgriculturalInsuranceWorkspace"));
const FarmerFirstProductsWorkspace = lazy(() => import("./pages/FarmerFirstProductsWorkspace"));
const FarmerImpactWorkspace = lazy(() => import("./pages/FarmerImpactWorkspace"));
const WeatherRiskWorkspace = lazy(() => import("./pages/WeatherRiskWorkspace"));
const AlertRulesWorkspace = lazy(() => import("./pages/AlertRulesWorkspace"));
const AnalyticsWidgetsWorkspace = lazy(() => import("./pages/AnalyticsWidgetsWorkspace"));
const AnimalIdTraceabilityWorkspace = lazy(() => import("./pages/AnimalIdTraceabilityWorkspace"));
const AnomalyDetectorWorkspace = lazy(() => import("./pages/AnomalyDetectorWorkspace"));
const ApiKeyManagementWorkspace = lazy(() => import("./pages/ApiKeyManagementWorkspace"));
const ApprovalWorkflowWorkspace = lazy(() => import("./pages/ApprovalWorkflowWorkspace"));
const AreaYieldIndexInsuranceWorkspace = lazy(() => import("./pages/AreaYieldIndexInsuranceWorkspace"));
const AuditTrailWorkspace = lazy(() => import("./pages/AuditTrailWorkspace"));
const AuthEnforcerWorkspace = lazy(() => import("./pages/AuthEnforcerWorkspace"));
const BVNNINVerificationWorkspace = lazy(() => import("./pages/BVNNINVerificationWorkspace"));
const BackupManagerWorkspace = lazy(() => import("./pages/BackupManagerWorkspace"));
const BankGuaranteesWorkspace = lazy(() => import("./pages/BankGuaranteesWorkspace"));
const BaselEngineWorkspace = lazy(() => import("./pages/BaselEngineWorkspace"));
const BatchAggregatorWorkspace = lazy(() => import("./pages/BatchAggregatorWorkspace"));
const BNPLWorkspace = lazy(() => import("./pages/BNPLWorkspace"));
const BatchEodWorkspace = lazy(() => import("./pages/BatchEodWorkspace"));
const BatchProcessingWorkspace = lazy(() => import("./pages/BatchProcessingWorkspace"));
const BeneficialOwnershipWorkspace = lazy(() => import("./pages/BeneficialOwnershipWorkspace"));
const BeneficiaryManagementWorkspace = lazy(() => import("./pages/BeneficiaryManagementWorkspace"));
const BillingEngineWorkspace = lazy(() => import("./pages/BillingEngineWorkspace"));
const BillingEventProcessorWorkspace = lazy(() => import("./pages/BillingEventProcessorWorkspace"));
const BillingOrchestratorWorkspace = lazy(() => import("./pages/BillingOrchestratorWorkspace"));
const BillingRbacWorkspace = lazy(() => import("./pages/BillingRbacWorkspace"));
const BiometricAuthWorkspace = lazy(() => import("./pages/BiometricAuthWorkspace"));
const BranchOperationsWorkspace = lazy(() => import("./pages/BranchOperationsWorkspace"));
const BranchPerformanceMapWorkspace = lazy(() => import("./pages/BranchPerformanceMapWorkspace"));
const BrandedCommsWorkspace = lazy(() => import("./pages/BrandedCommsWorkspace"));
const BulkPaymentsWorkspace = lazy(() => import("./pages/BulkPaymentsWorkspace"));
const CACVerificationWorkspace = lazy(() => import("./pages/CACVerificationWorkspace"));
const CBNComplianceCheckerWorkspace = lazy(() => import("./pages/CBNComplianceCheckerWorkspace"));
const CBNReturnsWorkspace = lazy(() => import("./pages/CBNReturnsWorkspace"));
const CIFManagementWorkspace = lazy(() => import("./pages/CIFManagementWorkspace"));
const CTRAutoFilerWorkspace = lazy(() => import("./pages/CTRAutoFilerWorkspace"));
const CardFraudRulesWorkspace = lazy(() => import("./pages/CardFraudRulesWorkspace"));
const CardManagementWorkspace = lazy(() => import("./pages/CardManagementWorkspace"));
const CardTokensWorkspace = lazy(() => import("./pages/CardTokensWorkspace"));
const CashManagementWorkspace = lazy(() => import("./pages/CashManagementWorkspace"));
const CashPoolingWorkspace = lazy(() => import("./pages/CashPoolingWorkspace"));
const CbnAgriReturnsWorkspace = lazy(() => import("./pages/CbnAgriReturnsWorkspace"));
const CbnAgsmeisWorkspace = lazy(() => import("./pages/CbnAgsmeisWorkspace"));
const CbnAnchorBorrowersWorkspace = lazy(() => import("./pages/CbnAnchorBorrowersWorkspace"));
const ChannelManagementWorkspace = lazy(() => import("./pages/ChannelManagementWorkspace"));
const ChartOfAccountsWorkspace = lazy(() => import("./pages/ChartOfAccountsWorkspace"));
const ChatbotWorkspace = lazy(() => import("./pages/ChatbotWorkspace"));
const ChequeClearingWorkspace = lazy(() => import("./pages/ChequeClearingWorkspace"));
const ChequeImagingWorkspace = lazy(() => import("./pages/ChequeImagingWorkspace"));
const CarbonCreditsWorkspace = lazy(() => import("./pages/CarbonCreditsWorkspace"));
const CocoIndexPipelineWorkspace = lazy(() => import("./pages/CocoIndexPipelineWorkspace"));
const CollateralValuationWorkspace = lazy(() => import("./pages/CollateralValuationWorkspace"));
const CollateralWorkspace = lazy(() => import("./pages/CollateralWorkspace"));
const CommodityExchangeWorkspace = lazy(() => import("./pages/CommodityExchangeWorkspace"));
const CommodityPriceIntelligenceWorkspace = lazy(() => import("./pages/CommodityPriceIntelligenceWorkspace"));
const ComplaintsWorkspace = lazy(() => import("./pages/ComplaintsWorkspace"));
const ComplianceChecksWorkspace = lazy(() => import("./pages/ComplianceChecksWorkspace"));
const ContingentLiabilitiesWorkspace = lazy(() => import("./pages/ContingentLiabilitiesWorkspace"));
const ContinuousLivenessWorkspace = lazy(() => import("./pages/ContinuousLivenessWorkspace"));
const CooperativeCreditScoringWorkspace = lazy(() => import("./pages/CooperativeCreditScoringWorkspace"));
const CooperativeFinancialsWorkspace = lazy(() => import("./pages/CooperativeFinancialsWorkspace"));
const CooperativeManagementWorkspace = lazy(() => import("./pages/CooperativeManagementWorkspace"));
const CooperativeMeetingsWorkspace = lazy(() => import("./pages/CooperativeMeetingsWorkspace"));
const CorporateDocVerifyWorkspace = lazy(() => import("./pages/CorporateDocVerifyWorkspace"));
const CorporateMonitoringWorkspace = lazy(() => import("./pages/CorporateMonitoringWorkspace"));
const CorrespondentBankingWorkspace = lazy(() => import("./pages/CorrespondentBankingWorkspace"));
const CreditBureauWorkspace = lazy(() => import("./pages/CreditBureauWorkspace"));
const CreditFacilitiesWorkspace = lazy(() => import("./pages/CreditFacilitiesWorkspace"));
const CreditRiskWorkspace = lazy(() => import("./pages/CreditRiskWorkspace"));
const CreditScoringWorkspace = lazy(() => import("./pages/CreditScoringWorkspace"));
const CropYieldPredictionWorkspace = lazy(() => import("./pages/CropYieldPredictionWorkspace"));
const CrossborderAgriTradeWorkspace = lazy(() => import("./pages/CrossborderAgriTradeWorkspace"));
const CustodyServiceWorkspace = lazy(() => import("./pages/CustodyServiceWorkspace"));
const CustomDomainWorkspace = lazy(() => import("./pages/CustomDomainWorkspace"));
const Customer360DashboardWorkspace = lazy(() => import("./pages/Customer360DashboardWorkspace"));
const Customer360Workspace = lazy(() => import("./pages/Customer360Workspace"));
const CustomerCards = lazy(() => import("./pages/CustomerCards"));
const CustomerEngagementWorkspace = lazy(() => import("./pages/CustomerEngagementWorkspace"));
const CustomerFeedbackWorkspace = lazy(() => import("./pages/CustomerFeedbackWorkspace"));
const CustomerInsightsWorkspace = lazy(() => import("./pages/CustomerInsightsWorkspace"));
const CustomerLoans = lazy(() => import("./pages/CustomerLoans"));
const CustomerOnboardingWorkspace = lazy(() => import("./pages/CustomerOnboardingWorkspace"));
const CustomerSegmentsWorkspace = lazy(() => import("./pages/CustomerSegmentsWorkspace"));
const DataExportWorkspace = lazy(() => import("./pages/DataExportWorkspace"));
const DebtCollectionWorkspace = lazy(() => import("./pages/DebtCollectionWorkspace"));
const DiasporaBankingWorkspace = lazy(() => import("./pages/DiasporaBankingWorkspace"));
const DisputeManagementWorkspace = lazy(() => import("./pages/DisputeManagementWorkspace"));
const DocCollectionsWorkspace = lazy(() => import("./pages/DocCollectionsWorkspace"));
const DocumentManagementWorkspace = lazy(() => import("./pages/DocumentManagementWorkspace"));
const DormancyManagementWorkspace = lazy(() => import("./pages/DormancyManagementWorkspace"));
const DormancyWorkspace = lazy(() => import("./pages/DormancyWorkspace"));
const EFASSKYCReturnsWorkspace = lazy(() => import("./pages/EFASSKYCReturnsWorkspace"));
const ENairaWorkspace = lazy(() => import("./pages/ENairaWorkspace"));
const EODProcessorWorkspace = lazy(() => import("./pages/EODProcessorWorkspace"));
const ERPNextWorkspace = lazy(() => import("./pages/ERPNextWorkspace"));
const ESGBankingWorkspace = lazy(() => import("./pages/ESGBankingWorkspace"));
const EtheriscWorkspace = lazy(() => import("./pages/EtheriscWorkspace"));
const ETDTradingWorkspace = lazy(() => import("./pages/ETDTradingWorkspace"));
const ETLPipelinesWorkspace = lazy(() => import("./pages/ETLPipelinesWorkspace"));
const EducationLoansWorkspace = lazy(() => import("./pages/EducationLoansWorkspace"));
const EmbeddedFinanceWorkspace = lazy(() => import("./pages/EmbeddedFinanceWorkspace"));
const EquipmentLeasingWorkspace = lazy(() => import("./pages/EquipmentLeasingWorkspace"));
const EscrowWorkspace = lazy(() => import("./pages/EscrowWorkspace"));
const EsusuWorkspace = lazy(() => import("./pages/EsusuWorkspace"));
const EventBusWorkspace = lazy(() => import("./pages/EventBusWorkspace"));
const EventCorrelatorWorkspace = lazy(() => import("./pages/EventCorrelatorWorkspace"));
const EventDedupEngineWorkspace = lazy(() => import("./pages/EventDedupEngineWorkspace"));
const EventStreamingWorkspace = lazy(() => import("./pages/EventStreamingWorkspace"));
const ExamManagementWorkspace = lazy(() => import("./pages/ExamManagementWorkspace"));
const ExpenseMgmtWorkspace = lazy(() => import("./pages/ExpenseMgmtWorkspace"));
const FATCACRSWorkspace = lazy(() => import("./pages/FATCACRSWorkspace"));
const FXDealingRoomWorkspace = lazy(() => import("./pages/FXDealingRoomWorkspace"));
const FXPositionsWorkspace = lazy(() => import("./pages/FXPositionsWorkspace"));
const FXRatesWorkspace = lazy(() => import("./pages/FXRatesWorkspace"));
const FXRevaluationWorkspace = lazy(() => import("./pages/FXRevaluationWorkspace"));
const FaceMatchWorkspace = lazy(() => import("./pages/FaceMatchWorkspace"));
const FactoringWorkspace = lazy(() => import("./pages/FactoringWorkspace"));
const FarmBoundaryMappingWorkspace = lazy(() => import("./pages/FarmBoundaryMappingWorkspace"));
const FeeManagementWorkspace = lazy(() => import("./pages/FeeManagementWorkspace"));
const FeeSchedulesWorkspace = lazy(() => import("./pages/FeeSchedulesWorkspace"));
const FisheriesAquacultureWorkspace = lazy(() => import("./pages/FisheriesAquacultureWorkspace"));
const FixedAssetsWorkspace = lazy(() => import("./pages/FixedAssetsWorkspace"));
const FixedDepositsWorkspace = lazy(() => import("./pages/FixedDepositsWorkspace"));
const FraudAlertsWorkspace = lazy(() => import("./pages/FraudAlertsWorkspace"));
const FraudDetectionWorkspace = lazy(() => import("./pages/FraudDetectionWorkspace"));
const FraudFusionEnsembleWorkspace = lazy(() => import("./pages/FraudFusionEnsembleWorkspace"));
const FraudRulesWorkspace = lazy(() => import("./pages/FraudRulesWorkspace"));
const GLAccountsWorkspace = lazy(() => import("./pages/GLAccountsWorkspace"));
const GLEngineWorkspace = lazy(() => import("./pages/GLEngineWorkspace"));
const GNNFraudDetectionWorkspace = lazy(() => import("./pages/GNNFraudDetectionWorkspace"));
const GamificationWorkspace = lazy(() => import("./pages/GamificationWorkspace"));
const GoAMLIntegrationWorkspace = lazy(() => import("./pages/GoAMLIntegrationWorkspace"));
const GrafanaDashboardsWorkspace = lazy(() => import("./pages/GrafanaDashboardsWorkspace"));
const GridTokenCardWorkspace = lazy(() => import("./pages/GridTokenCardWorkspace"));
const IFRS9EngineWorkspace = lazy(() => import("./pages/IFRS9EngineWorkspace"));
const ISO20022HubWorkspace = lazy(() => import("./pages/ISO20022HubWorkspace"));
const IdentityChannelsWorkspace = lazy(() => import("./pages/IdentityChannelsWorkspace"));
const InsurancePortfolioAnalyticsWorkspace = lazy(() => import("./pages/InsurancePortfolioAnalyticsWorkspace"));
const InsuranceWorkspace = lazy(() => import("./pages/InsuranceWorkspace"));
const InteractiveUssdAgriWorkspace = lazy(() => import("./pages/InteractiveUssdAgriWorkspace"));
const InvestmentWorkspace = lazy(() => import("./pages/InvestmentWorkspace"));
const InterbankLendingWorkspace = lazy(() => import("./pages/InterbankLendingWorkspace"));
const InterestAccrualWorkspace = lazy(() => import("./pages/InterestAccrualWorkspace"));
const InterestComputationWorkspace = lazy(() => import("./pages/InterestComputationWorkspace"));
const InterestRateWorkspace = lazy(() => import("./pages/InterestRateWorkspace"));
const InventoryWorkspace = lazy(() => import("./pages/InventoryWorkspace"));
const IslamicBankingWorkspace = lazy(() => import("./pages/IslamicBankingWorkspace"));
const JournalEntriesWorkspace = lazy(() => import("./pages/JournalEntriesWorkspace"));
const KPIDashboardWorkspace = lazy(() => import("./pages/KPIDashboardWorkspace"));
const KYBEngineWorkspace = lazy(() => import("./pages/KYBEngineWorkspace"));
const KYBTriggersWorkspace = lazy(() => import("./pages/KYBTriggersWorkspace"));
const KYBVerification = lazy(() => import("./pages/KYBVerification"));
const KYCAMLWorkspace = lazy(() => import("./pages/KYCAMLWorkspace"));
const KYCAnalyticsDashWorkspace = lazy(() => import("./pages/KYCAnalyticsDashWorkspace"));
const KYCDataQualityWorkspace = lazy(() => import("./pages/KYCDataQualityWorkspace"));
const KYCEngineWorkspace = lazy(() => import("./pages/KYCEngineWorkspace"));
const KYCEnhancedSummaryWorkspace = lazy(() => import("./pages/KYCEnhancedSummaryWorkspace"));
const KYCEventRulesWorkspace = lazy(() => import("./pages/KYCEventRulesWorkspace"));
const KYCOverridesWorkspace = lazy(() => import("./pages/KYCOverridesWorkspace"));
const KYCSelfServiceWorkspace = lazy(() => import("./pages/KYCSelfServiceWorkspace"));
const KYCServiceGatesWorkspace = lazy(() => import("./pages/KYCServiceGatesWorkspace"));
const KYCTieredDashboardWorkspace = lazy(() => import("./pages/KYCTieredDashboardWorkspace"));
const KYCTriggersWorkspace = lazy(() => import("./pages/KYCTriggersWorkspace"));
const KYCWorkflowWorkspace = lazy(() => import("./pages/KYCWorkflowWorkspace"));
const LCAmendmentsWorkspace = lazy(() => import("./pages/LCAmendmentsWorkspace"));
const LCRNSFRWorkspace = lazy(() => import("./pages/LCRNSFRWorkspace"));
const LeasingWorkspace = lazy(() => import("./pages/LeasingWorkspace"));
const LedgerSyncWorkspace = lazy(() => import("./pages/LedgerSyncWorkspace"));
const LedgerWorkspace = lazy(() => import("./pages/LedgerWorkspace"));
const LimitManagementWorkspace = lazy(() => import("./pages/LimitManagementWorkspace"));
const LivenessDetectionWorkspace = lazy(() => import("./pages/LivenessDetectionWorkspace"));
const LivestockFinanceWorkspace = lazy(() => import("./pages/LivestockFinanceWorkspace"));
const LivestockInsuranceWorkspace = lazy(() => import("./pages/LivestockInsuranceWorkspace"));
const LivestockManagementWorkspace = lazy(() => import("./pages/LivestockManagementWorkspace"));
const LoanAccountsWorkspace = lazy(() => import("./pages/LoanAccountsWorkspace"));
const LoanCalculatorWorkspace = lazy(() => import("./pages/LoanCalculatorWorkspace"));
const LoanOriginationWorkspace = lazy(() => import("./pages/LoanOriginationWorkspace"));
const LoanProductsWorkspace = lazy(() => import("./pages/LoanProductsWorkspace"));
const MakerCheckerWorkspace = lazy(() => import("./pages/MakerCheckerWorkspace"));
const MandateManagementWorkspace = lazy(() => import("./pages/MandateManagementWorkspace"));
const MicrofinanceEngineWorkspace = lazy(() => import("./pages/MicrofinanceEngineWorkspace"));
const MicrofinanceWorkspace = lazy(() => import("./pages/MicrofinanceWorkspace"));
const MobileBankingWorkspace = lazy(() => import("./pages/MobileBankingWorkspace"));
const MoneyMarketWorkspace = lazy(() => import("./pages/MoneyMarketWorkspace"));
const MortgageWorkspace = lazy(() => import("./pages/MortgageWorkspace"));
const MultiBureauCheckWorkspace = lazy(() => import("./pages/MultiBureauCheckWorkspace"));
const MultiCurrencyFxWorkspace = lazy(() => import("./pages/MultiCurrencyFxWorkspace"));
const MultiEntityWorkspace = lazy(() => import("./pages/MultiEntityWorkspace"));
const MultiPerilCropInsuranceWorkspace = lazy(() => import("./pages/MultiPerilCropInsuranceWorkspace"));
const MurabahaCalculatorWorkspace = lazy(() => import("./pages/MurabahaCalculatorWorkspace"));
const NDPRComplianceWorkspace = lazy(() => import("./pages/NDPRComplianceWorkspace"));
const NFIUCTRSTRFilingWorkspace = lazy(() => import("./pages/NFIUCTRSTRFilingWorkspace"));
const NIBSSDirectDebitWorkspace = lazy(() => import("./pages/NIBSSDirectDebitWorkspace"));
const NirsalAgroGeocoopWorkspace = lazy(() => import("./pages/NirsalAgroGeocoopWorkspace"));
const NirsalCreditGuaranteeWorkspace = lazy(() => import("./pages/NirsalCreditGuaranteeWorkspace"));
const NotificationCenterWorkspace = lazy(() => import("./pages/NotificationCenterWorkspace"));
const NotificationPreferencesWorkspace = lazy(() => import("./pages/NotificationPreferencesWorkspace"));
const NotificationsWorkspace = lazy(() => import("./pages/NotificationsWorkspace"));
const OTPHardeningWorkspace = lazy(() => import("./pages/OTPHardeningWorkspace"));
const OfflineResilienceWorkspace = lazy(() => import("./pages/OfflineResilienceWorkspace"));
const OfflineTransactionsWorkspace = lazy(() => import("./pages/OfflineTransactionsWorkspace"));
const OpenBankingWorkspace = lazy(() => import("./pages/OpenBankingWorkspace"));
const OAuthAppRegistrationWorkspace = lazy(() => import("./pages/OAuthAppRegistrationWorkspace"));
const OtcDerivativesWorkspace = lazy(() => import("./pages/OtcDerivativesWorkspace"));
const PEPDatabaseWorkspace = lazy(() => import("./pages/PEPDatabaseWorkspace"));
const PEPEnhancedDDWorkspace = lazy(() => import("./pages/PEPEnhancedDDWorkspace"));
const POSTerminalWorkspace = lazy(() => import("./pages/POSTerminalWorkspace"));
const ParametricInsuranceIotWorkspace = lazy(() => import("./pages/ParametricInsuranceIotWorkspace"));
const PaymentInvestigationWorkspace = lazy(() => import("./pages/PaymentInvestigationWorkspace"));
const PaymentTransactionsWorkspace = lazy(() => import("./pages/PaymentTransactionsWorkspace"));
const PaymentsHubWorkspace = lazy(() => import("./pages/PaymentsHubWorkspace"));
const PensionWorkspace = lazy(() => import("./pages/PensionWorkspace"));
const PortfolioMgmtWorkspace = lazy(() => import("./pages/PortfolioMgmtWorkspace"));
const PostHarvestLossTrackerWorkspace = lazy(() => import("./pages/PostHarvestLossTrackerWorkspace"));
const PricingModelWorkspace = lazy(() => import("./pages/PricingModelWorkspace"));
const ProductCatalogWorkspace = lazy(() => import("./pages/ProductCatalogWorkspace"));
const ProductFactoryWorkspace = lazy(() => import("./pages/ProductFactoryWorkspace"));
const ProjectFinanceWorkspace = lazy(() => import("./pages/ProjectFinanceWorkspace"));
const QRPaymentsWorkspace = lazy(() => import("./pages/QRPaymentsWorkspace"));
const QualityCertificationWorkspace = lazy(() => import("./pages/QualityCertificationWorkspace"));
const RateCascadeWorkspace = lazy(() => import("./pages/RateCascadeWorkspace"));
const RealtimePricingWorkspace = lazy(() => import("./pages/RealtimePricingWorkspace"));
const ReconciliationWorkspace = lazy(() => import("./pages/ReconciliationWorkspace"));
const RegulatoryAutomationWorkspace = lazy(() => import("./pages/RegulatoryAutomationWorkspace"));
const RegulatoryCalendarWorkspace = lazy(() => import("./pages/RegulatoryCalendarWorkspace"));
const RegulatoryReportingWorkspace = lazy(() => import("./pages/RegulatoryReportingWorkspace"));
const RegulatorySandboxWorkspace = lazy(() => import("./pages/RegulatorySandboxWorkspace"));
const RelationshipPricingWorkspace = lazy(() => import("./pages/RelationshipPricingWorkspace"));
const RemittanceWorkspace = lazy(() => import("./pages/RemittanceWorkspace"));
const ReportGenerationWorkspace = lazy(() => import("./pages/ReportGenerationWorkspace"));
const ReportingWorkspace = lazy(() => import("./pages/ReportingWorkspace"));
const RiskBasedApproachWorkspace = lazy(() => import("./pages/RiskBasedApproachWorkspace"));
const RiskScoringWorkspace = lazy(() => import("./pages/RiskScoringWorkspace"));
const SARFilingEngineWorkspace = lazy(() => import("./pages/SARFilingEngineWorkspace"));
const SandboxEnvironmentWorkspace = lazy(() => import("./pages/SandboxEnvironmentWorkspace"));
const SARReportsWorkspace = lazy(() => import("./pages/SARReportsWorkspace"));
const SMSBankingWorkspace = lazy(() => import("./pages/SMSBankingWorkspace"));
const SMSEmailGatewayWorkspace = lazy(() => import("./pages/SMSEmailGatewayWorkspace"));
const SWAPICacheWorkspace = lazy(() => import("./pages/SWAPICacheWorkspace"));
const SWIFTMessagesWorkspace = lazy(() => import("./pages/SWIFTMessagesWorkspace"));
const SafeDepositWorkspace = lazy(() => import("./pages/SafeDepositWorkspace"));
const SalaryProcessingWorkspace = lazy(() => import("./pages/SalaryProcessingWorkspace"));
const SanctionsBatchRescreenerWorkspace = lazy(() => import("./pages/SanctionsBatchRescreenerWorkspace"));
const SanctionsScreeningWorkspace = lazy(() => import("./pages/SanctionsScreeningWorkspace"));
const SatelliteCropMonitorWorkspace = lazy(() => import("./pages/SatelliteCropMonitorWorkspace"));
const SavingsProductsWorkspace = lazy(() => import("./pages/SavingsProductsWorkspace"));
const ScratchCardPINWorkspace = lazy(() => import("./pages/ScratchCardPINWorkspace"));
const SecuritiesTradingWorkspace = lazy(() => import("./pages/SecuritiesTradingWorkspace"));
const SeedRegistryWorkspace = lazy(() => import("./pages/SeedRegistryWorkspace"));
const SelfServiceTransactionsWorkspace = lazy(() => import("./pages/SelfServiceTransactionsWorkspace"));
const ServiceCatalogWorkspace = lazy(() => import("./pages/ServiceCatalogWorkspace"));
const ServiceHealthWorkspace = lazy(() => import("./pages/ServiceHealthWorkspace"));
const ServiceRegistryWorkspace = lazy(() => import("./pages/ServiceRegistryWorkspace"));
const SignatureVerificationWorkspace = lazy(() => import("./pages/SignatureVerificationWorkspace"));
const SmsAlertNotificationWorkspace = lazy(() => import("./pages/SmsAlertNotificationWorkspace"));
const SmsBankingGatewayWorkspace = lazy(() => import("./pages/SmsBankingGatewayWorkspace"));
const SmsOtpServiceWorkspace = lazy(() => import("./pages/SmsOtpServiceWorkspace"));
const SoilAnalysisWorkspace = lazy(() => import("./pages/SoilAnalysisWorkspace"));
const StaffManagementWorkspace = lazy(() => import("./pages/StaffManagementWorkspace"));
const StandingChargesWorkspace = lazy(() => import("./pages/StandingChargesWorkspace"));
const StandingInstructionsWorkspace = lazy(() => import("./pages/StandingInstructionsWorkspace"));
const StandingOrdersWorkspace = lazy(() => import("./pages/StandingOrdersWorkspace"));
const StatementGeneratorWorkspace = lazy(() => import("./pages/StatementGeneratorWorkspace"));
const StatementHistoryWorkspace = lazy(() => import("./pages/StatementHistoryWorkspace"));
const SukukManagementWorkspace = lazy(() => import("./pages/SukukManagementWorkspace"));
const SupplyChainFinanceWorkspace = lazy(() => import("./pages/SupplyChainFinanceWorkspace"));
const SwiftMessagingWorkspace = lazy(() => import("./pages/SwiftMessagingWorkspace"));
const SyndicatedLoansWorkspace = lazy(() => import("./pages/SyndicatedLoansWorkspace"));
const TakafulManagementWorkspace = lazy(() => import("./pages/TakafulManagementWorkspace"));
const TaxReportingWorkspace = lazy(() => import("./pages/TaxReportingWorkspace"));
const TelegramBankingCommandsWorkspace = lazy(() => import("./pages/TelegramBankingCommandsWorkspace"));
const TelegramBotGatewayWorkspace = lazy(() => import("./pages/TelegramBotGatewayWorkspace"));
const TelegramKycBotWorkspace = lazy(() => import("./pages/TelegramKycBotWorkspace"));
const TelegramMiniAppWorkspace = lazy(() => import("./pages/TelegramMiniAppWorkspace"));
const TelegramNotificationWorkspace = lazy(() => import("./pages/TelegramNotificationWorkspace"));
const TellerWorkspace = lazy(() => import("./pages/TellerWorkspace"));
const TemporalSagasWorkspace = lazy(() => import("./pages/TemporalSagasWorkspace"));
const TradeFinanceWorkspace = lazy(() => import("./pages/TradeFinanceWorkspace"));
const TreasuryInvestmentsWorkspace = lazy(() => import("./pages/TreasuryInvestmentsWorkspace"));
const TreasuryLiquidityWorkspace = lazy(() => import("./pages/TreasuryLiquidityWorkspace"));
const TreasuryWorkspace = lazy(() => import("./pages/TreasuryWorkspace"));
const TrustEstateWorkspace = lazy(() => import("./pages/TrustEstateWorkspace"));
const TxnMonitoringRulesWorkspace = lazy(() => import("./pages/TxnMonitoringRulesWorkspace"));
const TxnPatternAnalyzerWorkspace = lazy(() => import("./pages/TxnPatternAnalyzerWorkspace"));
const TypologyDetectorWorkspace = lazy(() => import("./pages/TypologyDetectorWorkspace"));
const UBOOwnershipGraphWorkspace = lazy(() => import("./pages/UBOOwnershipGraphWorkspace"));
const USSDBankingWorkspace = lazy(() => import("./pages/USSDBankingWorkspace"));
const UssdBankingGatewayWorkspace = lazy(() => import("./pages/UssdBankingGatewayWorkspace"));
const UssdMultilingualWorkspace = lazy(() => import("./pages/UssdMultilingualWorkspace"));
const UssdSimToolkitWorkspace = lazy(() => import("./pages/UssdSimToolkitWorkspace"));
const UssdTransactionEngineWorkspace = lazy(() => import("./pages/UssdTransactionEngineWorkspace"));
const UtilityPaymentsWorkspace = lazy(() => import("./pages/UtilityPaymentsWorkspace"));
const VideoKYCWorkspace = lazy(() => import("./pages/VideoKYCWorkspace"));
const VirtualAccountsWorkspace = lazy(() => import("./pages/VirtualAccountsWorkspace"));
const VoiceAgentEscalationWorkspace = lazy(() => import("./pages/VoiceAgentEscalationWorkspace"));
const VoiceAsrNigerianWorkspace = lazy(() => import("./pages/VoiceAsrNigerianWorkspace"));
const VoiceBankingGatewayWorkspace = lazy(() => import("./pages/VoiceBankingGatewayWorkspace"));
const VoiceBiometricAuthWorkspace = lazy(() => import("./pages/VoiceBiometricAuthWorkspace"));
const VoiceCallAnalyticsWorkspace = lazy(() => import("./pages/VoiceCallAnalyticsWorkspace"));
const VoiceIvrMenuWorkspace = lazy(() => import("./pages/VoiceIvrMenuWorkspace"));
const VoiceNluBankingWorkspace = lazy(() => import("./pages/VoiceNluBankingWorkspace"));
const VoiceTtsNigerianWorkspace = lazy(() => import("./pages/VoiceTtsNigerianWorkspace"));
const WakalaInvestmentWorkspace = lazy(() => import("./pages/WakalaInvestmentWorkspace"));
const WarehouseManagementWorkspace = lazy(() => import("./pages/WarehouseManagementWorkspace"));
const WatchlistManagerWorkspace = lazy(() => import("./pages/WatchlistManagerWorkspace"));
const WatchlistWorkspace = lazy(() => import("./pages/WatchlistWorkspace"));
const WealthMgmtWorkspace = lazy(() => import("./pages/WealthMgmtWorkspace"));
const WebhookDeliveriesWorkspace = lazy(() => import("./pages/WebhookDeliveriesWorkspace"));
const WebhookEngineWorkspace = lazy(() => import("./pages/WebhookEngineWorkspace"));
const WebhookSubscriptionsWorkspace = lazy(() => import("./pages/WebhookSubscriptionsWorkspace"));
const WhatsappBankingFlowsWorkspace = lazy(() => import("./pages/WhatsappBankingFlowsWorkspace"));
const WhatsappBusinessGatewayWorkspace = lazy(() => import("./pages/WhatsappBusinessGatewayWorkspace"));
const WhatsappDocumentServiceWorkspace = lazy(() => import("./pages/WhatsappDocumentServiceWorkspace"));
const WhatsappNotificationWorkspace = lazy(() => import("./pages/WhatsappNotificationWorkspace"));
const WhatsappPaymentIntegrationWorkspace = lazy(() => import("./pages/WhatsappPaymentIntegrationWorkspace"));
const WireTransferMonitorWorkspace = lazy(() => import("./pages/WireTransferMonitorWorkspace"));
const WorkflowDefinitionsWorkspace = lazy(() => import("./pages/WorkflowDefinitionsWorkspace"));
const WorkflowEngineWorkspace = lazy(() => import("./pages/WorkflowEngineWorkspace"));
const WorkflowInstancesWorkspace = lazy(() => import("./pages/WorkflowInstancesWorkspace"));

// ERP Integration
const ERPIntegrationPage = lazy(() => import("./pages/erp-integration/ERPIntegrationPage"));
// COMMENTED OUT: onboardingService import (no longer used)
// import { onboardingService } from "./services/onboarding";

function Router() {
  const TEMPORAL_ACCESS_STORAGE_KEY = "temporal_access_grants";
  const [location, setLocation] = useLocation();
  const isLoginPage = location === "/login";
  const isOnboardingPage = location === "/admin/onboarding";
  // COMMENTED OUT: isKYCPage (no longer used)
  // const isKYCPage = location === '/kyc';
  const isAuthenticated = localStorage.getItem("54link-dev_auth") === "true";

  // Keep temporal access grants in sync while authenticated
  useEffect(() => {
    if (!(isAuthenticated && !isLoginPage)) return;

    let isActive = true;
    let intervalId: number | undefined;

    const startPolling = async () => {
      const { temporalAccessService } = await import("@/services/temporalAccessService");
      if (!isActive) return;

      const tenantId =
        import.meta.env.VITE_TENANT_ID ||
        localStorage.getItem("tenant_id") ||
        undefined;
      const keycloakId = localStorage.getItem("keycloak_id");

      if (!tenantId || !keycloakId) return;

      const fetchGrants = async () => {
        try {
          const grants = await temporalAccessService.listUserGrants(
            tenantId,
            keycloakId
          );
          localStorage.setItem(TEMPORAL_ACCESS_STORAGE_KEY, JSON.stringify(grants));
        } catch (error) {
          console.error("Failed to refresh temporal access grants:", error);
        }
      };

      await fetchGrants();
      intervalId = window.setInterval(fetchGrants, 60_000);
    };

    startPolling();

    return () => {
      isActive = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [isAuthenticated, isLoginPage]);

  // KYC verification state
  const [showKYCDialog, setShowKYCDialog] = useState(false);
  const [kycUrl, setKycUrl] = useState<string | null>(null);

  // Check KYC verification status on authentication
  useEffect(() => {
    if (isAuthenticated && !isLoginPage) {
      const authUserStr = localStorage.getItem("auth_user");
      if (authUserStr) {
        try {
          const authUser = JSON.parse(authUserStr);
          // Check is_verified field from admin response
          const isVerified = authUser.is_verified;
          const kycVerificationUrl =
            authUser.kyc_url || authUser.kyc_verification_url;

          // Show KYC dialog if not verified
          if (isVerified === false) {
            setKycUrl(kycVerificationUrl);
            setShowKYCDialog(true);
          } else {
            setShowKYCDialog(false);
          }
        } catch (error) {
          console.error("Failed to parse auth_user from localStorage:", error);
        }
      }
    } else {
      setShowKYCDialog(false);
    }
  }, [isAuthenticated, isLoginPage, location]);

  const handleKYCLogout = () => {
    authService.logout();
    setShowKYCDialog(false);
    setLocation("/login");
  };

  // Fetch tenant data on page load if authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoginPage) {
      const fetchTenantData = async () => {
        try {
          const { tenantService } = await import("./services/tenant");
          // Only fetch if we don't already have tenant config in localStorage
          // or if it's been more than 5 minutes since last fetch
          const existingConfig = tenantService.getTenantConfig();
          if (!existingConfig) {
            await tenantService.getTenant();
            console.log("Tenant config loaded and stored in localStorage");
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error fetching tenant data:", errorMessage);
          // Don't block the app if tenant fetch fails
        }
      };

      fetchTenantData();
    }
  }, [isAuthenticated, isLoginPage]);

  // COMMENTED OUT: Onboarding check and redirect
  // Check onboarding status and redirect if needed
  // useEffect(() => {
  //   if (isAuthenticated && !isLoginPage && !isOnboardingPage && !isKYCPage) {
  //     const isOnboardingComplete = onboardingService.isOnboardingComplete();
  //     if (!isOnboardingComplete) {
  //       setLocation('/admin/onboarding');
  //     }
  //   }
  // }, [isAuthenticated, isLoginPage, isOnboardingPage, isKYCPage, setLocation]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoginPage) {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoginPage, setLocation]);

  if (!isAuthenticated && !isLoginPage) {
    return null;
  }

  // Dashboard route by tenant role (v2.perm `tenants` entity named roles)
  // Priority: standalone tenant_role key > auth_user.tenant_role > auth_user.access_level > admin_data.access_level
  let tenantRole = localStorage.getItem("tenant_role") || "";
  if (!tenantRole) {
    const authUserStr = localStorage.getItem("auth_user");
    if (authUserStr) {
      try {
        const authUser = JSON.parse(authUserStr);
        tenantRole =
          authUser.tenant_role || authUser.access_level || authUser.role || "";
      } catch {}
    }
  }
  if (!tenantRole) {
    const adminDataStr = localStorage.getItem("admin_data");
    if (adminDataStr) {
      try {
        const adminData = JSON.parse(adminDataStr);
        tenantRole = adminData.access_level || adminData.tenant_role || "";
      } catch {}
    }
  }
  if (!tenantRole) tenantRole = "support_agent";

  // Map all 13 v2.perm tenants roles to dedicated dashboard components
  const dashboardByRole: Record<string, React.ComponentType> = {
    super_admin: SuperAdminDashboard,
    branch_manager: BankAdminDashboard,
    operations_manager: OperationsOfficerDashboard,
    risk_manager: ComplianceOfficerDashboard,
    internal_auditor: AuditorDashboard,
    it_admin: TechnicalAdminDashboard,
    relationship_manager: RelationshipManagerDashboard,
    trade_finance_admin: FinanceAdminDashboard,
    vault_manager: VaultManagerDashboard,
    treasury_manager: TreasuryManagerDashboard,
    loan_officer: LoanOfficerDashboard,
    compliance_officer: ComplianceOfficerDashboard,
    support_agent: CustomerSupportDashboard,
  };
  const DashboardComponent = dashboardByRole[tenantRole] ?? Dashboard;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* KYC Verification Dialog - blocks all access */}
      <KYCVerificationDialog
        open={showKYCDialog}
        kycUrl={kycUrl}
        onLogout={handleKYCLogout}
      />

      {!isLoginPage && !isOnboardingPage && <Sidebar />}
      <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600" />
        </div>
      }>
        <Switch>
          <Route path="/" component={DashboardComponent} />
          <Route path="/branches" component={BankManagement} />
          <Route path="/teller" component={TellerManagement} />
          <Route path="/teller-operations" component={TellerOperations} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/loans" component={Loans} />
          <Route path="/lpo" component={LPO} />
          <Route path="/disputes" component={Disputes} />
          <Route path="/savings" component={Savings} />
          <Route path="/tenant-management" component={TenantManagement} />
          <Route path="/chart-of-accounts" component={ChartOfAccountsPage} />
          <Route path="/erp-integration" component={ERPIntegrationPage} />

          {/* Transaction & Application Screens */}
          <Route path="/deposit" component={DepositScreen} />
          <Route path="/transfer" component={TransferScreen} />
          <Route path="/loan-payment" component={LoanPaymentScreen} />
          <Route path="/lpo-payment" component={LpoPaymentScreen} />
          <Route path="/loan-application" component={LoanApplicationScreen} />
          <Route
            path="/mortgage-application"
            component={MortgageApplicationScreen}
          />
          <Route
            path="/education-loan-application"
            component={EducationLoanApplicationScreen}
          />
          <Route
            path="/islamic-banking-application"
            component={IslamicBankingApplicationScreen}
          />
          <Route path="/lpo-application" component={LpoApplicationScreen} />
          <Route path="/card-dashboard" component={CardDashboard} />
          <Route path="/dispute" component={DisputeScreen} />

          {/* Banking Features */}
          <Route path="/mortgage-banking" component={MortgageBanking} />
          <Route path="/escrow-management" component={EscrowManagement} />
          <Route path="/esusu-management" component={EsusuManagement} />
          <Route path="/van-management" component={VirtualAccountManagement} />
          <Route path="/agriculture-banking" component={AgricultureBanking} />
          <Route path="/agriculture-farmers" component={AgricultureFarmers} />
          <Route path="/agriculture-farms" component={AgricultureFarms} />
          <Route path="/agriculture-agtech" component={AgricultureAgTech} />
          <Route path="/agriculture-loans" component={AgricultureLoans} />
          <Route path="/agriculture-analytics" component={AgricultureAnalytics} />
          <Route path="/agriculture-regulatory" component={AgricultureRegulatory} />
          <Route path="/agriculture-value-chain" component={AgricultureValueChain} />
          <Route path="/agriculture-insurance" component={AgricultureInsurance} />
          <Route path="/agriculture-partners" component={AgriculturePartners} />
          <Route path="/agriculture-risk" component={AgricultureRisk} />
          <Route path="/education-banking" component={EducationBanking} />
          <Route path="/islamic-banking" component={IslamicBanking} />
          <Route path="/features" component={FeatureFlags} />
          <Route path="/billing" component={Billing} />
          <Route path="/billing-ledger" component={BillingLedger} />
          <Route path="/monitoring" component={Monitoring} />
          <Route path="/usage-analytics" component={UsageAnalytics} />
          <Route path="/alert-settings" component={AlertSettings} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/alert-rules" component={AlertRules} />
          <Route path="/group-lending" component={GroupLending} />
          <Route path="/agent-banking" component={AgentBanking} />
          <Route path="/regulatory-reporting" component={RegulatoryReporting} />
          <Route path="/onboarding" component={BankOnboarding} />

          {/* Communication Hub */}
          <Route path="/communication-hub" component={CommunicationHub} />

          {/* Insurance */}
          <Route path="/insurance" component={InsurancePage} />
          {/* Admin Routes */}
          <Route path="/admin/analytics" component={AdminAnalytics} />
          <Route path="/admin/cards" component={AdminCards} />
          <Route path="/admin/admins" component={AdminManagement} />
          <Route path="/admin/temporal-access" component={TemporalAccess} />
          <Route path="/my-access" component={MyAccess} />
          {/* <Route path="/admin/onboarding" component={AdminOnboarding} /> */}

          {/* Customer Feedback */}
          <Route path="/feedback" component={CustomerFeedback} />

          {/* Relationship Manager Portal */}
          <Route path="/relationship-manager" component={RelationshipManager} />

          {/* User Management & Audit Logs */}
          <Route path="/users" component={UserManagement} />
          <Route path="/audit-logs" component={AuditLogs} />
          <Route path="/institutions" component={Institutions} />

          {/* KYC & Onboarding */}
          <Route path="/kyc" component={KYC} />
          <Route path="/business-management" component={BusinessManagement} />

          {/* Auth & Utility */}
          <Route path="/login" component={Login} />
          <Route path="/change-password" component={ChangePassword} />
          <Route path="/home" component={Home} />
          <Route path="/curriculum" component={Curriculum} />
          <Route path="/infrastructure" component={Infrastructure} />
          <Route path="/resources" component={Resources} />
          <Route path="/quick-reference" component={QuickReference} />
          <Route path="/labs" component={Labs} />
          <Route path="/404" component={NotFound} />
          {/* Workspace Routes */}
          <Route path="/ai-fraud-detection" component={AIFraudDetectionWorkspace} />
          <Route path="/aml-case-manager" component={AMLCaseManagerWorkspace} />
          <Route path="/aml-compliance-dashboard" component={AMLComplianceDashboardWorkspace} />
          <Route path="/aml-regulatory-reporting" component={AMLRegulatoryReportingWorkspace} />
          <Route path="/aml-risk-scoring" component={AMLRiskScoringWorkspace} />
          <Route path="/aml-training-tracker" component={AMLTrainingTrackerWorkspace} />
          <Route path="/atm-management" component={ATMManagementWorkspace} />
          <Route path="/account-opening" component={AccountOpeningWorkspace} />
          <Route path="/account-statements" component={AccountStatementsWorkspace} />
          <Route path="/accounting-rules" component={AccountingRulesWorkspace} />
          <Route path="/acgsf-guarantee" component={AcgsfGuaranteeWorkspace} />
          <Route path="/address-verification" component={AddressVerificationWorkspace} />
          <Route path="/adverse-media-scanner" component={AdverseMediaScannerWorkspace} />
          <Route path="/adverse-media" component={AdverseMediaWorkspace} />
          <Route path="/agent-farmer-onboarding" component={AgentFarmerOnboardingWorkspace} />
          <Route path="/agent-kyc-capture" component={AgentKYCCaptureWorkspace} />
          <Route path="/agent-performance" component={AgentPerformanceWorkspace} />
          <Route path="/aggregation-center" component={AggregationCenterWorkspace} />
          <Route path="/agri-esg-impact" component={AgriEsgImpactWorkspace} />
          <Route path="/agri-evoucher" component={AgriEvoucherWorkspace} />
          <Route path="/agri-input-marketplace" component={AgriInputMarketplaceWorkspace} />
          <Route path="/agri-iot-sensor" component={AgriIotSensorWorkspace} />
          <Route path="/agri-logistics" component={AgriLogisticsWorkspace} />
          <Route path="/agri-reinsurance" component={AgriReinsuranceWorkspace} />
          <Route path="/agri-savings-cycles" component={AgriSavingsCyclesWorkspace} />
          <Route path="/agricultural-insurance" component={AgriculturalInsuranceWorkspace} />
          <Route path="/farmer-first-products" component={FarmerFirstProductsWorkspace} />
          <Route path="/farmer-impact" component={FarmerImpactWorkspace} />
          <Route path="/weather-risk" component={WeatherRiskWorkspace} />
          <Route path="/alert-rules-engine" component={AlertRulesWorkspace} />
          <Route path="/analytics-widgets" component={AnalyticsWidgetsWorkspace} />
          <Route path="/animal-id-traceability" component={AnimalIdTraceabilityWorkspace} />
          <Route path="/anomaly-detector" component={AnomalyDetectorWorkspace} />
          <Route path="/approval-workflow" component={ApprovalWorkflowWorkspace} />
          <Route path="/area-yield-index-insurance" component={AreaYieldIndexInsuranceWorkspace} />
          <Route path="/audit-trail" component={AuditTrailWorkspace} />
          <Route path="/auth-enforcer" component={AuthEnforcerWorkspace} />
          <Route path="/bvnnin-verification" component={BVNNINVerificationWorkspace} />
          <Route path="/backup-manager" component={BackupManagerWorkspace} />
          <Route path="/bank-guarantees" component={BankGuaranteesWorkspace} />
          <Route path="/basel-engine" component={BaselEngineWorkspace} />
          <Route path="/bnpl" component={BNPLWorkspace} />
          <Route path="/batch-aggregator" component={BatchAggregatorWorkspace} />
          <Route path="/batch-eod" component={BatchEodWorkspace} />
          <Route path="/batch-processing" component={BatchProcessingWorkspace} />
          <Route path="/beneficial-ownership" component={BeneficialOwnershipWorkspace} />
          <Route path="/beneficiary-management" component={BeneficiaryManagementWorkspace} />
          <Route path="/billing-engine" component={BillingEngineWorkspace} />
          <Route path="/billing-event-processor" component={BillingEventProcessorWorkspace} />
          <Route path="/billing-orchestrator" component={BillingOrchestratorWorkspace} />
          <Route path="/billing-rbac" component={BillingRbacWorkspace} />
          <Route path="/biometric-auth" component={BiometricAuthWorkspace} />
          <Route path="/branch-operations" component={BranchOperationsWorkspace} />
          <Route path="/branch-performance-map" component={BranchPerformanceMapWorkspace} />
          <Route path="/branded-comms" component={BrandedCommsWorkspace} />
          <Route path="/bulk-payments" component={BulkPaymentsWorkspace} />
          <Route path="/carbon-credits" component={CarbonCreditsWorkspace} />
          <Route path="/cac-verification" component={CACVerificationWorkspace} />
          <Route path="/cbn-compliance-checker" component={CBNComplianceCheckerWorkspace} />
          <Route path="/cbn-returns" component={CBNReturnsWorkspace} />
          <Route path="/cif-management" component={CIFManagementWorkspace} />
          <Route path="/ctr-auto-filer" component={CTRAutoFilerWorkspace} />
          <Route path="/card-fraud-rules" component={CardFraudRulesWorkspace} />
          <Route path="/card-management" component={CardManagementWorkspace} />
          <Route path="/card-tokens" component={CardTokensWorkspace} />
          <Route path="/cash-management" component={CashManagementWorkspace} />
          <Route path="/cash-pooling" component={CashPoolingWorkspace} />
          <Route path="/cbn-agri-returns" component={CbnAgriReturnsWorkspace} />
          <Route path="/cbn-agsmeis" component={CbnAgsmeisWorkspace} />
          <Route path="/cbn-anchor-borrowers" component={CbnAnchorBorrowersWorkspace} />
          <Route path="/channel-management" component={ChannelManagementWorkspace} />
          <Route path="/chart-of-accounts-engine" component={ChartOfAccountsWorkspace} />
          <Route path="/chatbot" component={ChatbotWorkspace} />
          <Route path="/cheque-clearing" component={ChequeClearingWorkspace} />
          <Route path="/cheque-imaging" component={ChequeImagingWorkspace} />
          <Route path="/coco-index-pipeline" component={CocoIndexPipelineWorkspace} />
          <Route path="/collateral-valuation" component={CollateralValuationWorkspace} />
          <Route path="/collateral" component={CollateralWorkspace} />
          <Route path="/commodity-exchange" component={CommodityExchangeWorkspace} />
          <Route path="/commodity-price-intelligence" component={CommodityPriceIntelligenceWorkspace} />
          <Route path="/complaints" component={ComplaintsWorkspace} />
          <Route path="/compliance-checks" component={ComplianceChecksWorkspace} />
          <Route path="/contingent-liabilities" component={ContingentLiabilitiesWorkspace} />
          <Route path="/continuous-liveness" component={ContinuousLivenessWorkspace} />
          <Route path="/cooperative-credit-scoring" component={CooperativeCreditScoringWorkspace} />
          <Route path="/cooperative-financials" component={CooperativeFinancialsWorkspace} />
          <Route path="/cooperative-management" component={CooperativeManagementWorkspace} />
          <Route path="/cooperative-meetings" component={CooperativeMeetingsWorkspace} />
          <Route path="/corporate-doc-verify" component={CorporateDocVerifyWorkspace} />
          <Route path="/corporate-monitoring" component={CorporateMonitoringWorkspace} />
          <Route path="/correspondent-banking" component={CorrespondentBankingWorkspace} />
          <Route path="/credit-bureau" component={CreditBureauWorkspace} />
          <Route path="/credit-facilities" component={CreditFacilitiesWorkspace} />
          <Route path="/credit-risk" component={CreditRiskWorkspace} />
          <Route path="/credit-scoring" component={CreditScoringWorkspace} />
          <Route path="/crop-yield-prediction" component={CropYieldPredictionWorkspace} />
          <Route path="/crossborder-agri-trade" component={CrossborderAgriTradeWorkspace} />
          <Route path="/custody-service" component={CustodyServiceWorkspace} />
          <Route path="/custom-domain" component={CustomDomainWorkspace} />
          <Route path="/customer360-dashboard" component={Customer360DashboardWorkspace} />
          <Route path="/customer360" component={Customer360Workspace} />
          <Route path="/customer-cards" component={CustomerCards} />
          <Route path="/customer-engagement" component={CustomerEngagementWorkspace} />
          <Route path="/customer-feedback" component={CustomerFeedbackWorkspace} />
          <Route path="/customer-insights" component={CustomerInsightsWorkspace} />
          <Route path="/customer-loans" component={CustomerLoans} />
          <Route path="/customer-onboarding" component={CustomerOnboardingWorkspace} />
          <Route path="/customer-segments" component={CustomerSegmentsWorkspace} />
          <Route path="/data-export" component={DataExportWorkspace} />
          <Route path="/debt-collection" component={DebtCollectionWorkspace} />
          <Route path="/diaspora-banking" component={DiasporaBankingWorkspace} />
          <Route path="/dispute-management" component={DisputeManagementWorkspace} />
          <Route path="/doc-collections" component={DocCollectionsWorkspace} />
          <Route path="/document-management" component={DocumentManagementWorkspace} />
          <Route path="/dormancy-management" component={DormancyManagementWorkspace} />
          <Route path="/dormancy-portal" component={DormancyWorkspace} />
          <Route path="/efasskyc-returns" component={EFASSKYCReturnsWorkspace} />
          <Route path="/e-naira" component={ENairaWorkspace} />
          <Route path="/eod-processor" component={EODProcessorWorkspace} />
          <Route path="/erp-next" component={ERPNextWorkspace} />
          <Route path="/esg-banking" component={ESGBankingWorkspace} />
          <Route path="/etherisc" component={EtheriscWorkspace} />
          <Route path="/etd-trading" component={ETDTradingWorkspace} />
          <Route path="/etl-pipelines" component={ETLPipelinesWorkspace} />
          <Route path="/education-loans" component={EducationLoansWorkspace} />
          <Route path="/embedded-finance" component={EmbeddedFinanceWorkspace} />
          <Route path="/equipment-leasing" component={EquipmentLeasingWorkspace} />
          <Route path="/escrow-portal" component={EscrowWorkspace} />
          <Route path="/esusu-portal" component={EsusuWorkspace} />
          <Route path="/event-bus" component={EventBusWorkspace} />
          <Route path="/event-correlator" component={EventCorrelatorWorkspace} />
          <Route path="/event-dedup-engine" component={EventDedupEngineWorkspace} />
          <Route path="/event-streaming" component={EventStreamingWorkspace} />
          <Route path="/exam-management" component={ExamManagementWorkspace} />
          <Route path="/expense-mgmt" component={ExpenseMgmtWorkspace} />
          <Route path="/fatcacrs" component={FATCACRSWorkspace} />
          <Route path="/fx-dealing-room" component={FXDealingRoomWorkspace} />
          <Route path="/fx-positions" component={FXPositionsWorkspace} />
          <Route path="/fx-rates" component={FXRatesWorkspace} />
          <Route path="/fx-revaluation" component={FXRevaluationWorkspace} />
          <Route path="/face-match" component={FaceMatchWorkspace} />
          <Route path="/factoring" component={FactoringWorkspace} />
          <Route path="/farm-boundary-mapping" component={FarmBoundaryMappingWorkspace} />
          <Route path="/fee-management" component={FeeManagementWorkspace} />
          <Route path="/fee-schedules" component={FeeSchedulesWorkspace} />
          <Route path="/fisheries-aquaculture" component={FisheriesAquacultureWorkspace} />
          <Route path="/fixed-assets" component={FixedAssetsWorkspace} />
          <Route path="/fixed-deposits" component={FixedDepositsWorkspace} />
          <Route path="/fraud-alerts" component={FraudAlertsWorkspace} />
          <Route path="/fraud-detection" component={FraudDetectionWorkspace} />
          <Route path="/fraud-fusion-ensemble" component={FraudFusionEnsembleWorkspace} />
          <Route path="/fraud-rules" component={FraudRulesWorkspace} />
          <Route path="/gamification" component={GamificationWorkspace} />
          <Route path="/gl-accounts" component={GLAccountsWorkspace} />
          <Route path="/gl-engine" component={GLEngineWorkspace} />
          <Route path="/gnn-fraud-detection" component={GNNFraudDetectionWorkspace} />
          <Route path="/go-aml-integration" component={GoAMLIntegrationWorkspace} />
          <Route path="/grafana-dashboards" component={GrafanaDashboardsWorkspace} />
          <Route path="/grid-token-card" component={GridTokenCardWorkspace} />
          <Route path="/ifrs9-engine" component={IFRS9EngineWorkspace} />
          <Route path="/iso20022-hub" component={ISO20022HubWorkspace} />
          <Route path="/identity-channels" component={IdentityChannelsWorkspace} />
          <Route path="/insurance-portfolio-analytics" component={InsurancePortfolioAnalyticsWorkspace} />
          <Route path="/insurance-portal" component={InsuranceWorkspace} />
          <Route path="/interactive-ussd-agri" component={InteractiveUssdAgriWorkspace} />
          <Route path="/investments" component={InvestmentWorkspace} />
          <Route path="/interbank-lending" component={InterbankLendingWorkspace} />
          <Route path="/interest-accrual" component={InterestAccrualWorkspace} />
          <Route path="/interest-computation" component={InterestComputationWorkspace} />
          <Route path="/interest-rate" component={InterestRateWorkspace} />
          <Route path="/inventory" component={InventoryWorkspace} />
          <Route path="/islamic-banking-portal" component={IslamicBankingWorkspace} />
          <Route path="/journal-entries" component={JournalEntriesWorkspace} />
          <Route path="/kpi-dashboard" component={KPIDashboardWorkspace} />
          <Route path="/kyb-engine" component={KYBEngineWorkspace} />
          <Route path="/kyb-triggers" component={KYBTriggersWorkspace} />
          <Route path="/kyb-verification" component={KYBVerification} />
          <Route path="/kycaml" component={KYCAMLWorkspace} />
          <Route path="/kyc-analytics-dash" component={KYCAnalyticsDashWorkspace} />
          <Route path="/kyc-data-quality" component={KYCDataQualityWorkspace} />
          <Route path="/kyc-engine" component={KYCEngineWorkspace} />
          <Route path="/kyc-enhanced-summary" component={KYCEnhancedSummaryWorkspace} />
          <Route path="/kyc-event-rules" component={KYCEventRulesWorkspace} />
          <Route path="/kyc-overrides" component={KYCOverridesWorkspace} />
          <Route path="/kyc-self-service" component={KYCSelfServiceWorkspace} />
          <Route path="/kyc-service-gates" component={KYCServiceGatesWorkspace} />
          <Route path="/kyc-tiered-dashboard" component={KYCTieredDashboardWorkspace} />
          <Route path="/kyc-triggers" component={KYCTriggersWorkspace} />
          <Route path="/kyc-workflow" component={KYCWorkflowWorkspace} />
          <Route path="/lc-amendments" component={LCAmendmentsWorkspace} />
          <Route path="/lcrnsfr" component={LCRNSFRWorkspace} />
          <Route path="/leasing" component={LeasingWorkspace} />
          <Route path="/ledger-sync" component={LedgerSyncWorkspace} />
          <Route path="/ledger" component={LedgerWorkspace} />
          <Route path="/limit-management" component={LimitManagementWorkspace} />
          <Route path="/liveness-detection" component={LivenessDetectionWorkspace} />
          <Route path="/livestock-finance" component={LivestockFinanceWorkspace} />
          <Route path="/livestock-insurance" component={LivestockInsuranceWorkspace} />
          <Route path="/livestock-management" component={LivestockManagementWorkspace} />
          <Route path="/loan-accounts" component={LoanAccountsWorkspace} />
          <Route path="/loan-calculator" component={LoanCalculatorWorkspace} />
          <Route path="/loan-origination" component={LoanOriginationWorkspace} />
          <Route path="/loan-products" component={LoanProductsWorkspace} />
          <Route path="/maker-checker" component={MakerCheckerWorkspace} />
          <Route path="/mandate-management" component={MandateManagementWorkspace} />
          <Route path="/microfinance-engine" component={MicrofinanceEngineWorkspace} />
          <Route path="/microfinance" component={MicrofinanceWorkspace} />
          <Route path="/mobile-banking" component={MobileBankingWorkspace} />
          <Route path="/money-market" component={MoneyMarketWorkspace} />
          <Route path="/mortgage-portal" component={MortgageWorkspace} />
          <Route path="/multi-bureau-check" component={MultiBureauCheckWorkspace} />
          <Route path="/multi-currency-fx" component={MultiCurrencyFxWorkspace} />
          <Route path="/multi-entity" component={MultiEntityWorkspace} />
          <Route path="/multi-peril-crop-insurance" component={MultiPerilCropInsuranceWorkspace} />
          <Route path="/murabaha-calculator" component={MurabahaCalculatorWorkspace} />
          <Route path="/ndpr-compliance" component={NDPRComplianceWorkspace} />
          <Route path="/nfiuctrstr-filing" component={NFIUCTRSTRFilingWorkspace} />
          <Route path="/nibss-direct-debit" component={NIBSSDirectDebitWorkspace} />
          <Route path="/nirsal-agro-geocoop" component={NirsalAgroGeocoopWorkspace} />
          <Route path="/nirsal-credit-guarantee" component={NirsalCreditGuaranteeWorkspace} />
          <Route path="/notification-center" component={NotificationCenterWorkspace} />
          <Route path="/notification-preferences" component={NotificationPreferencesWorkspace} />
          <Route path="/notifications" component={NotificationsWorkspace} />
          <Route path="/otp-hardening" component={OTPHardeningWorkspace} />
          <Route path="/offline-resilience" component={OfflineResilienceWorkspace} />
          <Route path="/offline-transactions" component={OfflineTransactionsWorkspace} />
          <Route path="/open-banking" component={OpenBankingWorkspace} />
          <Route path="/otc-derivatives" component={OtcDerivativesWorkspace} />
          <Route path="/pep-database" component={PEPDatabaseWorkspace} />
          <Route path="/pep-enhanced-dd" component={PEPEnhancedDDWorkspace} />
          <Route path="/pos-terminal" component={POSTerminalWorkspace} />
          <Route path="/parametric-insurance-iot" component={ParametricInsuranceIotWorkspace} />
          <Route path="/payment-investigation" component={PaymentInvestigationWorkspace} />
          <Route path="/payment-transactions" component={PaymentTransactionsWorkspace} />
          <Route path="/payments-hub" component={PaymentsHubWorkspace} />
          <Route path="/pension" component={PensionWorkspace} />
          <Route path="/portfolio-mgmt" component={PortfolioMgmtWorkspace} />
          <Route path="/post-harvest-loss-tracker" component={PostHarvestLossTrackerWorkspace} />
          <Route path="/pricing-model" component={PricingModelWorkspace} />
          <Route path="/product-catalog" component={ProductCatalogWorkspace} />
          <Route path="/product-factory" component={ProductFactoryWorkspace} />
          <Route path="/project-finance" component={ProjectFinanceWorkspace} />
          <Route path="/qr-payments" component={QRPaymentsWorkspace} />
          <Route path="/quality-certification" component={QualityCertificationWorkspace} />
          <Route path="/rate-cascade" component={RateCascadeWorkspace} />
          <Route path="/realtime-pricing" component={RealtimePricingWorkspace} />
          <Route path="/reconciliation" component={ReconciliationWorkspace} />
          <Route path="/regulatory-automation" component={RegulatoryAutomationWorkspace} />
          <Route path="/regulatory-calendar" component={RegulatoryCalendarWorkspace} />
          <Route path="/regulatory-reporting-engine" component={RegulatoryReportingWorkspace} />
          <Route path="/regulatory-sandbox" component={RegulatorySandboxWorkspace} />
          <Route path="/relationship-pricing" component={RelationshipPricingWorkspace} />
          <Route path="/remittance" component={RemittanceWorkspace} />
          <Route path="/report-generation" component={ReportGenerationWorkspace} />
          <Route path="/reporting" component={ReportingWorkspace} />
          <Route path="/risk-based-approach" component={RiskBasedApproachWorkspace} />
          <Route path="/risk-scoring" component={RiskScoringWorkspace} />
          <Route path="/sar-filing-engine" component={SARFilingEngineWorkspace} />
          <Route path="/sar-reports" component={SARReportsWorkspace} />
          <Route path="/sms-banking" component={SMSBankingWorkspace} />
          <Route path="/sms-email-gateway" component={SMSEmailGatewayWorkspace} />
          <Route path="/swapi-cache" component={SWAPICacheWorkspace} />
          <Route path="/swift-messages" component={SWIFTMessagesWorkspace} />
          <Route path="/safe-deposit" component={SafeDepositWorkspace} />
          <Route path="/salary-processing" component={SalaryProcessingWorkspace} />
          <Route path="/sanctions-batch-rescreener" component={SanctionsBatchRescreenerWorkspace} />
          <Route path="/sanctions-screening" component={SanctionsScreeningWorkspace} />
          <Route path="/satellite-crop-monitor" component={SatelliteCropMonitorWorkspace} />
          <Route path="/savings-products" component={SavingsProductsWorkspace} />
          <Route path="/scratch-card-pin" component={ScratchCardPINWorkspace} />
          <Route path="/securities-trading" component={SecuritiesTradingWorkspace} />
          <Route path="/seed-registry" component={SeedRegistryWorkspace} />
          <Route path="/self-service-transactions" component={SelfServiceTransactionsWorkspace} />
          <Route path="/service-catalog" component={ServiceCatalogWorkspace} />
          <Route path="/service-health" component={ServiceHealthWorkspace} />
          <Route path="/service-registry" component={ServiceRegistryWorkspace} />
          <Route path="/signature-verification" component={SignatureVerificationWorkspace} />
          <Route path="/sms-alert-notification" component={SmsAlertNotificationWorkspace} />
          <Route path="/sms-banking-gateway" component={SmsBankingGatewayWorkspace} />
          <Route path="/sms-otp-service" component={SmsOtpServiceWorkspace} />
          <Route path="/soil-analysis" component={SoilAnalysisWorkspace} />
          <Route path="/staff-management" component={StaffManagementWorkspace} />
          <Route path="/standing-charges" component={StandingChargesWorkspace} />
          <Route path="/standing-instructions" component={StandingInstructionsWorkspace} />
          <Route path="/standing-orders" component={StandingOrdersWorkspace} />
          <Route path="/statement-generator" component={StatementGeneratorWorkspace} />
          <Route path="/statement-history" component={StatementHistoryWorkspace} />
          <Route path="/sukuk-management" component={SukukManagementWorkspace} />
          <Route path="/supply-chain-finance" component={SupplyChainFinanceWorkspace} />
          <Route path="/swift-messaging" component={SwiftMessagingWorkspace} />
          <Route path="/syndicated-loans" component={SyndicatedLoansWorkspace} />
          <Route path="/takaful-management" component={TakafulManagementWorkspace} />
          <Route path="/tax-reporting" component={TaxReportingWorkspace} />
          <Route path="/telegram-banking-commands" component={TelegramBankingCommandsWorkspace} />
          <Route path="/telegram-bot-gateway" component={TelegramBotGatewayWorkspace} />
          <Route path="/telegram-kyc-bot" component={TelegramKycBotWorkspace} />
          <Route path="/telegram-mini-app" component={TelegramMiniAppWorkspace} />
          <Route path="/telegram-notification" component={TelegramNotificationWorkspace} />
          <Route path="/teller-workspace" component={TellerWorkspace} />
          <Route path="/temporal-sagas" component={TemporalSagasWorkspace} />
          <Route path="/trade-finance" component={TradeFinanceWorkspace} />
          <Route path="/treasury-investments" component={TreasuryInvestmentsWorkspace} />
          <Route path="/treasury-liquidity" component={TreasuryLiquidityWorkspace} />
          <Route path="/treasury" component={TreasuryWorkspace} />
          <Route path="/trust-estate" component={TrustEstateWorkspace} />
          <Route path="/txn-monitoring-rules" component={TxnMonitoringRulesWorkspace} />
          <Route path="/txn-pattern-analyzer" component={TxnPatternAnalyzerWorkspace} />
          <Route path="/typology-detector" component={TypologyDetectorWorkspace} />
          <Route path="/ubo-ownership-graph" component={UBOOwnershipGraphWorkspace} />
          <Route path="/ussd-banking" component={USSDBankingWorkspace} />
          <Route path="/ussd-banking-gateway" component={UssdBankingGatewayWorkspace} />
          <Route path="/ussd-multilingual" component={UssdMultilingualWorkspace} />
          <Route path="/ussd-sim-toolkit" component={UssdSimToolkitWorkspace} />
          <Route path="/ussd-transaction-engine" component={UssdTransactionEngineWorkspace} />
          <Route path="/utility-payments" component={UtilityPaymentsWorkspace} />
          <Route path="/video-kyc" component={VideoKYCWorkspace} />
          <Route path="/virtual-accounts" component={VirtualAccountsWorkspace} />
          <Route path="/voice-agent-escalation" component={VoiceAgentEscalationWorkspace} />
          <Route path="/voice-asr-nigerian" component={VoiceAsrNigerianWorkspace} />
          <Route path="/voice-banking-gateway" component={VoiceBankingGatewayWorkspace} />
          <Route path="/voice-biometric-auth" component={VoiceBiometricAuthWorkspace} />
          <Route path="/voice-call-analytics" component={VoiceCallAnalyticsWorkspace} />
          <Route path="/voice-ivr-menu" component={VoiceIvrMenuWorkspace} />
          <Route path="/voice-nlu-banking" component={VoiceNluBankingWorkspace} />
          <Route path="/voice-tts-nigerian" component={VoiceTtsNigerianWorkspace} />
          <Route path="/wakala-investment" component={WakalaInvestmentWorkspace} />
          <Route path="/warehouse-management" component={WarehouseManagementWorkspace} />
          <Route path="/watchlist-manager" component={WatchlistManagerWorkspace} />
          <Route path="/watchlist" component={WatchlistWorkspace} />
          <Route path="/wealth-mgmt" component={WealthMgmtWorkspace} />
          <Route path="/api-key-management" component={ApiKeyManagementWorkspace} />
          <Route path="/oauth-app-registration" component={OAuthAppRegistrationWorkspace} />
          <Route path="/sandbox-environment" component={SandboxEnvironmentWorkspace} />
          <Route path="/webhook-deliveries" component={WebhookDeliveriesWorkspace} />
          <Route path="/webhook-engine" component={WebhookEngineWorkspace} />
          <Route path="/webhook-subscriptions" component={WebhookSubscriptionsWorkspace} />
          <Route path="/whatsapp-banking-flows" component={WhatsappBankingFlowsWorkspace} />
          <Route path="/whatsapp-business-gateway" component={WhatsappBusinessGatewayWorkspace} />
          <Route path="/whatsapp-document-service" component={WhatsappDocumentServiceWorkspace} />
          <Route path="/whatsapp-notification" component={WhatsappNotificationWorkspace} />
          <Route path="/whatsapp-payment-integration" component={WhatsappPaymentIntegrationWorkspace} />
          <Route path="/wire-transfer-monitor" component={WireTransferMonitorWorkspace} />
          <Route path="/workflow-definitions" component={WorkflowDefinitionsWorkspace} />
          <Route path="/workflow-engine" component={WorkflowEngineWorkspace} />
          <Route path="/workflow-instances" component={WorkflowInstancesWorkspace} />

          {/* Final fallback route */}
          <Route component={NotFound} />
        </Switch>
        </Suspense>
      </div>
    </div>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600" />
      </div>
    }>
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light" switchable>
          <TenantBrandingProvider>
            <ProgressProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </ProgressProvider>
          </TenantBrandingProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </Suspense>
  );
}

export default App;

