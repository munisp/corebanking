// The recovered admin portal keeps its top-level route structure and sidebar-led shell,
// while the customer PWA remains a separate reference surface under /customer so both
// recovered archive applications can coexist in one active project.

import { lazy, Suspense, useState, useEffect, type ComponentType, type ReactNode } from "react";
import { Route, Switch } from "wouter";
import LoginPage from "@/components/LoginPage";

const ArchiveAdminSidebar = lazy(() => import("@/components/ArchiveAdminSidebar"));

const AdminAgentBankingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminAgentBankingPage })));
const AdminAlertRulesPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminAlertRulesPage })));
const AdminAlertsPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminAlertsPage })));
const AdminAlertSettingsPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminAlertSettingsPage })));
const AdminBanksPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminBanksPage })));
const AdminBillingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminBillingPage })));
const AdminCurriculumPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminCurriculumPage })));
const AdminInfrastructurePage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminInfrastructurePage })));
const AdminLabsPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminLabsPage })));
const AdminLoginPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminLoginPage })));
const AdminMonitoringPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminMonitoringPage })));
const AdminOnboardingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminOnboardingPage })));
const AdminQuickReferencePage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminQuickReferencePage })));
const AdminRegulatoryReportingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminRegulatoryReportingPage })));
const AdminResourcesPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminResourcesPage })));
const AdminUsageAnalyticsPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminUsageAnalyticsPage })));
const AdminGroupLendingPage = lazy(() => import("@/pages/ArchiveAdminRoutes").then((module) => ({ default: module.AdminGroupLendingPage })));

const AgricultureAgtechPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureAgtechPage })));
const AgricultureAnalyticsPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureAnalyticsPage })));
const AgricultureCompliancePage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureCompliancePage })));
const AgricultureFarmersPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureFarmersPage })));
const AgricultureLoansPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureLoansPage })));
const AgricultureOverviewPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureOverviewPage })));
const AgricultureRiskPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureRiskPage })));
const AgricultureValueChainPage = lazy(() => import("@/pages/ArchiveAgricultureRoutes").then((module) => ({ default: module.AgricultureValueChainPage })));

const CustomerBills = lazy(() => import("@/pages/CustomerBills"));
const CustomerCards = lazy(() => import("@/pages/CustomerCards"));
const CustomerDashboard = lazy(() => import("@/pages/CustomerDashboard"));
const CustomerLoans = lazy(() => import("@/pages/CustomerLoans"));
const CustomerNotifications = lazy(() => import("@/pages/CustomerNotifications"));
const CustomerQr = lazy(() => import("@/pages/CustomerQr"));
const CustomerSavings = lazy(() => import("@/pages/CustomerSavings"));
const CustomerSettings = lazy(() => import("@/pages/CustomerSettings"));
const CustomerStatements = lazy(() => import("@/pages/CustomerStatements"));
const CustomerTransfers = lazy(() => import("@/pages/CustomerTransfers"));
const DisputeManagementWorkspace = lazy(() => import("@/pages/DisputeManagementWorkspace"));
const ERPNextWorkspace = lazy(() => import("@/pages/ERPNextWorkspace"));
const EducationLoansWorkspace = lazy(() => import("@/pages/EducationLoansWorkspace"));
const EsusuWorkspace = lazy(() => import("@/pages/EsusuWorkspace"));
const Home = lazy(() => import("@/pages/Home"));
const VirtualAccountsWorkspace = lazy(() => import("@/pages/VirtualAccountsWorkspace"));
const IdentityChannelsWorkspace = lazy(() => import("@/pages/IdentityChannelsWorkspace"));
const IslamicBankingWorkspace = lazy(() => import("@/pages/IslamicBankingWorkspace"));
const LedgerSyncWorkspace = lazy(() => import("@/pages/LedgerSyncWorkspace"));
const MortgageWorkspace = lazy(() => import("@/pages/MortgageWorkspace"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const OperationsCenter = lazy(() => import("@/pages/OperationsCenter"));
const PartnerOnboardingAdminPage = lazy(() => import("@/pages/PartnerOnboardingAdminPage"));
const PartnerOnboardingPortalPage = lazy(() => import("@/pages/PartnerOnboardingPortalPage"));
const PricingModelWorkspace = lazy(() => import("@/pages/PricingModelWorkspace"));
const TellerWorkspace = lazy(() => import("@/pages/TellerWorkspace"));
const TradeFinanceWorkspace = lazy(() => import("@/pages/TradeFinanceWorkspace"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const BillingEngineWorkspace = lazy(() => import("@/pages/BillingEngineWorkspace"));
const PaymentsHubWorkspace = lazy(() => import("@/pages/PaymentsHubWorkspace"));
const SavingsProductsWorkspace = lazy(() => import("@/pages/SavingsProductsWorkspace"));
const CardManagementWorkspace = lazy(() => import("@/pages/CardManagementWorkspace"));
const TreasuryWorkspace = lazy(() => import("@/pages/TreasuryWorkspace"));
const CustomerEngagementWorkspace = lazy(() => import("@/pages/CustomerEngagementWorkspace"));
const FraudDetectionWorkspace = lazy(() => import("@/pages/FraudDetectionWorkspace"));
const NotificationCenterWorkspace = lazy(() => import("@/pages/NotificationCenterWorkspace"));
const AccountOpeningWorkspace = lazy(() => import("@/pages/AccountOpeningWorkspace"));
const StandingOrdersWorkspace = lazy(() => import("@/pages/StandingOrdersWorkspace"));
const BeneficiaryManagementWorkspace = lazy(() => import("@/pages/BeneficiaryManagementWorkspace"));
const LoanCalculatorWorkspace = lazy(() => import("@/pages/LoanCalculatorWorkspace"));
const BatchProcessingWorkspace = lazy(() => import("@/pages/BatchProcessingWorkspace"));
const FXRatesWorkspace = lazy(() => import("@/pages/FXRatesWorkspace"));
const BranchOperationsWorkspace = lazy(() => import("@/pages/BranchOperationsWorkspace"));
const LedgerWorkspace = lazy(() => import("@/pages/LedgerWorkspace"));
const EventBusWorkspace = lazy(() => import("@/pages/EventBusWorkspace"));
const WorkflowEngineWorkspace = lazy(() => import("@/pages/WorkflowEngineWorkspace"));
const MojaloopWorkspace = lazy(() => import("@/pages/MojaloopWorkspace"));
const OpenSearchWorkspace = lazy(() => import("@/pages/OpenSearchWorkspace"));
const LakehouseWorkspace = lazy(() => import("@/pages/LakehouseWorkspace"));
const FluvioStreamsWorkspace = lazy(() => import("@/pages/FluvioStreamsWorkspace"));
const DaprSidecarWorkspace = lazy(() => import("@/pages/DaprSidecarWorkspace"));
const PermifyWorkspace = lazy(() => import("@/pages/PermifyWorkspace"));
const KeycloakWorkspace = lazy(() => import("@/pages/KeycloakWorkspace"));
const InterestRateWorkspace = lazy(() => import("@/pages/InterestRateWorkspace"));
const ChequeClearingWorkspace = lazy(() => import("@/pages/ChequeClearingWorkspace"));
const Customer360Workspace = lazy(() => import("@/pages/Customer360Workspace"));
const NIBSSDirectDebitWorkspace = lazy(() => import("@/pages/NIBSSDirectDebitWorkspace"));
const DiasporaBankingWorkspace = lazy(() => import("@/pages/DiasporaBankingWorkspace"));
const KYCAMLWorkspace = lazy(() => import("@/pages/KYCAMLWorkspace"));
const LoanOriginationWorkspace = lazy(() => import("@/pages/LoanOriginationWorkspace"));
const AccountStatementsWorkspace = lazy(() => import("@/pages/AccountStatementsWorkspace"));
const BulkPaymentsWorkspace = lazy(() => import("@/pages/BulkPaymentsWorkspace"));
const CardManagementWorkspace2 = lazy(() => import("@/pages/CardManagementWorkspace2"));
const TreasuryLiquidityWorkspace = lazy(() => import("@/pages/TreasuryLiquidityWorkspace"));
const AgentBankingWorkspace2 = lazy(() => import("@/pages/AgentBankingWorkspace2"));
const ChartOfAccountsWorkspace = lazy(() => import("@/pages/ChartOfAccountsWorkspace"));
const JournalEntriesWorkspace = lazy(() => import("@/pages/JournalEntriesWorkspace"));
const ReportingWorkspace = lazy(() => import("@/pages/ReportingWorkspace"));
const PaymentTransactionsWorkspace = lazy(() => import("@/pages/PaymentTransactionsWorkspace"));
const LoanProductsWorkspace = lazy(() => import("@/pages/LoanProductsWorkspace"));
const LoanAccountsWorkspace = lazy(() => import("@/pages/LoanAccountsWorkspace"));
const AnalyticsWidgetsWorkspace = lazy(() => import("@/pages/AnalyticsWidgetsWorkspace"));
const ETLPipelinesWorkspace = lazy(() => import("@/pages/ETLPipelinesWorkspace"));
const FraudRulesWorkspace = lazy(() => import("@/pages/FraudRulesWorkspace"));
const FraudAlertsWorkspace = lazy(() => import("@/pages/FraudAlertsWorkspace"));
const WebhookSubscriptionsWorkspace = lazy(() => import("@/pages/WebhookSubscriptionsWorkspace"));
const WebhookDeliveriesWorkspace = lazy(() => import("@/pages/WebhookDeliveriesWorkspace"));
const AuditTrailWorkspace = lazy(() => import("@/pages/AuditTrailWorkspace"));
const ComplianceChecksWorkspace = lazy(() => import("@/pages/ComplianceChecksWorkspace"));
const RegulatoryCalendarWorkspace = lazy(() => import("@/pages/RegulatoryCalendarWorkspace"));
const CustomerOnboardingWorkspace = lazy(() => import("@/pages/CustomerOnboardingWorkspace"));
const FXDealingRoomWorkspace = lazy(() => import("@/pages/FXDealingRoomWorkspace"));
const FXPositionsWorkspace = lazy(() => import("@/pages/FXPositionsWorkspace"));
const DocCollectionsWorkspace = lazy(() => import("@/pages/DocCollectionsWorkspace"));
const TreasuryInvestmentsWorkspace = lazy(() => import("@/pages/TreasuryInvestmentsWorkspace"));
const SWIFTMessagesWorkspace = lazy(() => import("@/pages/SWIFTMessagesWorkspace"));
const CreditRiskWorkspace = lazy(() => import("@/pages/CreditRiskWorkspace"));
const ReconciliationWorkspace = lazy(() => import("@/pages/ReconciliationWorkspace"));
const FeeSchedulesWorkspace = lazy(() => import("@/pages/FeeSchedulesWorkspace"));
const NotificationPreferencesWorkspace = lazy(() => import("@/pages/NotificationPreferencesWorkspace"));
const DormancyWorkspace = lazy(() => import("@/pages/DormancyWorkspace"));
const InterestAccrualWorkspace = lazy(() => import("@/pages/InterestAccrualWorkspace"));
const LimitManagementWorkspace = lazy(() => import("@/pages/LimitManagementWorkspace"));
// KYC/KYB Enhanced Suite — 22 enhancements (5 phases)
const KYCTieredDashboardWorkspace = lazy(() => import("@/pages/KYCTieredDashboardWorkspace"));
const BVNNINVerificationWorkspace = lazy(() => import("@/pages/BVNNINVerificationWorkspace"));
const NFIUCTRSTRFilingWorkspace = lazy(() => import("@/pages/NFIUCTRSTRFilingWorkspace"));
const SanctionsScreeningWorkspace = lazy(() => import("@/pages/SanctionsScreeningWorkspace"));
const CACVerificationWorkspace = lazy(() => import("@/pages/CACVerificationWorkspace"));
const TxnMonitoringRulesWorkspace = lazy(() => import("@/pages/TxnMonitoringRulesWorkspace"));
const RiskBasedApproachWorkspace = lazy(() => import("@/pages/RiskBasedApproachWorkspace"));
const PEPEnhancedDDWorkspace = lazy(() => import("@/pages/PEPEnhancedDDWorkspace"));
const UBOOwnershipGraphWorkspace = lazy(() => import("@/pages/UBOOwnershipGraphWorkspace"));
const MultiBureauCheckWorkspace = lazy(() => import("@/pages/MultiBureauCheckWorkspace"));
const AddressVerificationWorkspace = lazy(() => import("@/pages/AddressVerificationWorkspace"));
const CorporateDocVerifyWorkspace = lazy(() => import("@/pages/CorporateDocVerifyWorkspace"));
const KYCAnalyticsDashWorkspace = lazy(() => import("@/pages/KYCAnalyticsDashWorkspace"));
const VideoKYCWorkspace = lazy(() => import("@/pages/VideoKYCWorkspace"));
const ContinuousLivenessWorkspace = lazy(() => import("@/pages/ContinuousLivenessWorkspace"));
const KYCWorkflowWorkspace = lazy(() => import("@/pages/KYCWorkflowWorkspace"));
const KYCSelfServiceWorkspace = lazy(() => import("@/pages/KYCSelfServiceWorkspace"));
const AgentKYCCaptureWorkspace = lazy(() => import("@/pages/AgentKYCCaptureWorkspace"));
const AdverseMediaWorkspace = lazy(() => import("@/pages/AdverseMediaWorkspace"));
const CorporateMonitoringWorkspace = lazy(() => import("@/pages/CorporateMonitoringWorkspace"));
const KYCDataQualityWorkspace = lazy(() => import("@/pages/KYCDataQualityWorkspace"));
const EFASSKYCReturnsWorkspace = lazy(() => import("@/pages/EFASSKYCReturnsWorkspace"));
const KYCEnhancedSummaryWorkspace = lazy(() => import("@/pages/KYCEnhancedSummaryWorkspace"));
const GNNFraudDetectionWorkspace = lazy(() => import("@/pages/GNNFraudDetectionWorkspace"));
const FraudFusionEnsembleWorkspace = lazy(() => import("@/pages/FraudFusionEnsembleWorkspace"));
const MCMCBayesianRiskWorkspace = lazy(() => import("@/pages/MCMCBayesianRiskWorkspace"));
const CocoIndexPipelineWorkspace = lazy(() => import("@/pages/CocoIndexPipelineWorkspace"));
const EPRKGQAWorkspace = lazy(() => import("@/pages/EPRKGQAWorkspace"));
const FalkorDBGraphWorkspace = lazy(() => import("@/pages/FalkorDBGraphWorkspace"));
const OllamaLLMWorkspace = lazy(() => import("@/pages/OllamaLLMWorkspace"));
const ARTAdversarialWorkspace = lazy(() => import("@/pages/ARTAdversarialWorkspace"));
const MojaloopPISPWorkspace = lazy(() => import("@/pages/MojaloopPISPWorkspace"));
const TBMultiCurrencyWorkspace = lazy(() => import("@/pages/TBMultiCurrencyWorkspace"));
const KafkaGovernanceWorkspace = lazy(() => import("@/pages/KafkaGovernanceWorkspace"));
/* Production Hardening — 30 improvements */
const CORSGatewayWorkspace = lazy(() => import("@/pages/CORSGatewayWorkspace"));
const AuthEnforcerWorkspace = lazy(() => import("@/pages/AuthEnforcerWorkspace"));
const RequestValidatorWorkspace = lazy(() => import("@/pages/RequestValidatorWorkspace"));
const APIVersioningWorkspace = lazy(() => import("@/pages/APIVersioningWorkspace"));
const APMSentryWorkspace = lazy(() => import("@/pages/APMSentryWorkspace"));
const SecretsRotationWorkspace = lazy(() => import("@/pages/SecretsRotationWorkspace"));
const DBMigrationManagerWorkspace = lazy(() => import("@/pages/DBMigrationManagerWorkspace"));
const ConnectionPoolerWorkspace = lazy(() => import("@/pages/ConnectionPoolerWorkspace"));
const BackupManagerWorkspace = lazy(() => import("@/pages/BackupManagerWorkspace"));
const UnitTestRunnerWorkspace = lazy(() => import("@/pages/UnitTestRunnerWorkspace"));
const E2EOrchestratorWorkspace = lazy(() => import("@/pages/E2EOrchestratorWorkspace"));
const ContractTestWorkspace = lazy(() => import("@/pages/ContractTestWorkspace"));
const LoadTestRunnerWorkspace = lazy(() => import("@/pages/LoadTestRunnerWorkspace"));
const OTelCollectorWorkspace = lazy(() => import("@/pages/OTelCollectorWorkspace"));
const ChangelogGeneratorWorkspace = lazy(() => import("@/pages/ChangelogGeneratorWorkspace"));
const HelmValidatorWorkspace = lazy(() => import("@/pages/HelmValidatorWorkspace"));
const AccessibilityAuditorWorkspace = lazy(() => import("@/pages/AccessibilityAuditorWorkspace"));
const I18nServiceWorkspace = lazy(() => import("@/pages/I18nServiceWorkspace"));
const CreditScoringWorkspace = lazy(() => import("@/pages/CreditScoringWorkspace"));
const DebtCollectionWorkspace = lazy(() => import("@/pages/DebtCollectionWorkspace"));
const AccountClosureWorkspace = lazy(() => import("@/pages/AccountClosureWorkspace"));
const DormancyManagementWorkspace = lazy(() => import("@/pages/DormancyManagementWorkspace"));
const InterestComputationWorkspace = lazy(() => import("@/pages/InterestComputationWorkspace"));
const FeeManagementWorkspace = lazy(() => import("@/pages/FeeManagementWorkspace"));
const TaxReportingWorkspace = lazy(() => import("@/pages/TaxReportingWorkspace"));
const RegulatorySandboxWorkspace = lazy(() => import("@/pages/RegulatorySandboxWorkspace"));
const APIAnalyticsWorkspace = lazy(() => import("@/pages/APIAnalyticsWorkspace"));
const DeveloperPortalWorkspace = lazy(() => import("@/pages/DeveloperPortalWorkspace"));
const Customer360DashboardWorkspace = lazy(() => import("@/pages/Customer360DashboardWorkspace"));
const RealtimePricingWorkspace = lazy(() => import("@/pages/RealtimePricingWorkspace"));
const GLAccountsWorkspace = lazy(() => import("@/pages/GLAccountsWorkspace"));
const CollateralWorkspace = lazy(() => import("@/pages/CollateralWorkspace"));
const ComplaintsWorkspace = lazy(() => import("@/pages/ComplaintsWorkspace"));
const InterbankSettlementWorkspace = lazy(() => import("@/pages/InterbankSettlementWorkspace"));
const StaffManagementWorkspace = lazy(() => import("@/pages/StaffManagementWorkspace"));
const ChannelManagementWorkspace = lazy(() => import("@/pages/ChannelManagementWorkspace"));
const FixedDepositsWorkspace = lazy(() => import("@/pages/FixedDepositsWorkspace"));
const StandingInstructionsWorkspace = lazy(() => import("@/pages/StandingInstructionsWorkspace"));
const CashManagementWorkspace = lazy(() => import("@/pages/CashManagementWorkspace"));
const CorrespondentBankingWorkspace = lazy(() => import("@/pages/CorrespondentBankingWorkspace"));
const ProductCatalogWorkspace = lazy(() => import("@/pages/ProductCatalogWorkspace"));
const CustomerSegmentsWorkspace = lazy(() => import("@/pages/CustomerSegmentsWorkspace"));
const SMSEmailGatewayWorkspace = lazy(() => import("@/pages/SMSEmailGatewayWorkspace"));
const RiskScoringWorkspace = lazy(() => import("@/pages/RiskScoringWorkspace"));
const RegulatoryReportingWorkspace = lazy(() => import("@/pages/RegulatoryReportingWorkspace"));
const ATMManagementWorkspace = lazy(() => import("@/pages/ATMManagementWorkspace"));
const DataExportWorkspace = lazy(() => import("@/pages/DataExportWorkspace"));
const CustomerInsightsWorkspace = lazy(() => import("@/pages/CustomerInsightsWorkspace"));
const SalaryProcessingWorkspace = lazy(() => import("@/pages/SalaryProcessingWorkspace"));
const CreditBureauWorkspace = lazy(() => import("@/pages/CreditBureauWorkspace"));
const DocumentManagementWorkspace = lazy(() => import("@/pages/DocumentManagementWorkspace"));
const POSTerminalWorkspace = lazy(() => import("@/pages/POSTerminalWorkspace"));
const CollateralValuationWorkspace = lazy(() => import("@/pages/CollateralValuationWorkspace"));
const CustomerFeedbackWorkspace = lazy(() => import("@/pages/CustomerFeedbackWorkspace"));
const MoneyMarketWorkspace = lazy(() => import("@/pages/MoneyMarketWorkspace"));
const SecuritiesTradingWorkspace = lazy(() => import("@/pages/SecuritiesTradingWorkspace"));
const SupplyChainFinanceWorkspace = lazy(() => import("@/pages/SupplyChainFinanceWorkspace"));
const CashPoolingWorkspace = lazy(() => import("@/pages/CashPoolingWorkspace"));
const BankGuaranteesWorkspace = lazy(() => import("@/pages/BankGuaranteesWorkspace"));
const OtcDerivativesWorkspace = lazy(() => import("@/pages/OtcDerivativesWorkspace"));
const ISO20022HubWorkspace = lazy(() => import("@/pages/ISO20022HubWorkspace"));
const BaselEngineWorkspace = lazy(() => import("@/pages/BaselEngineWorkspace"));
const IFRS9EngineWorkspace = lazy(() => import("@/pages/IFRS9EngineWorkspace"));
const OpenBankingWorkspace = lazy(() => import("@/pages/OpenBankingWorkspace"));
const InterbankLendingWorkspace = lazy(() => import("@/pages/InterbankLendingWorkspace"));
const PortfolioMgmtWorkspace = lazy(() => import("@/pages/PortfolioMgmtWorkspace"));
const WealthMgmtWorkspace = lazy(() => import("@/pages/WealthMgmtWorkspace"));
const CustodyServiceWorkspace = lazy(() => import("@/pages/CustodyServiceWorkspace"));
const FactoringWorkspace = lazy(() => import("@/pages/FactoringWorkspace"));
const SyndicatedLoansWorkspace = lazy(() => import("@/pages/SyndicatedLoansWorkspace"));
const ProjectFinanceWorkspace = lazy(() => import("@/pages/ProjectFinanceWorkspace"));
const LeasingWorkspace = lazy(() => import("@/pages/LeasingWorkspace"));
const ContingentLiabilitiesWorkspace = lazy(() => import("@/pages/ContingentLiabilitiesWorkspace"));
const ETDTradingWorkspace = lazy(() => import("@/pages/ETDTradingWorkspace"));
const PaymentInvestigationWorkspace = lazy(() => import("@/pages/PaymentInvestigationWorkspace"));
const StressTestingWorkspace = lazy(() => import("@/pages/StressTestingWorkspace"));
const APIMarketplaceWorkspace = lazy(() => import("@/pages/APIMarketplaceWorkspace"));
const ChatbotWorkspace = lazy(() => import("@/pages/ChatbotWorkspace"));
const GrowthFeaturesWorkspace = lazy(() => import("@/pages/GrowthFeaturesWorkspace"));
const SignatureVerificationWorkspace = lazy(() => import("@/pages/SignatureVerificationWorkspace"));
const RemittanceWorkspace = lazy(() => import("@/pages/RemittanceWorkspace"));
const MicrofinanceWorkspace = lazy(() => import("@/pages/MicrofinanceWorkspace"));
const UtilityPaymentsWorkspace = lazy(() => import("@/pages/UtilityPaymentsWorkspace"));
const MultiEntityWorkspace = lazy(() => import("@/pages/MultiEntityWorkspace"));
const TrustEstateWorkspace = lazy(() => import("@/pages/TrustEstateWorkspace"));
const EscrowWorkspace = lazy(() => import("@/pages/EscrowWorkspace"));
const QRPaymentsWorkspace = lazy(() => import("@/pages/QRPaymentsWorkspace"));
const FATCACRSWorkspace = lazy(() => import("@/pages/FATCACRSWorkspace"));
const BiometricAuthWorkspace = lazy(() => import("@/pages/BiometricAuthWorkspace"));
const SafeDepositWorkspace = lazy(() => import("@/pages/SafeDepositWorkspace"));
const FixedAssetsWorkspace = lazy(() => import("@/pages/FixedAssetsWorkspace"));
const ExpenseMgmtWorkspace = lazy(() => import("@/pages/ExpenseMgmtWorkspace"));
const InventoryWorkspace = lazy(() => import("@/pages/InventoryWorkspace"));
const InsuranceWorkspace = lazy(() => import("@/pages/InsuranceWorkspace"));
const PensionWorkspace = lazy(() => import("@/pages/PensionWorkspace"));
const LockerWorkspace = lazy(() => import("@/pages/LockerWorkspace"));
const StandingChargesWorkspace = lazy(() => import("@/pages/StandingChargesWorkspace"));
const SukukManagementWorkspace = lazy(() => import("@/pages/SukukManagementWorkspace"));
const TakafulManagementWorkspace = lazy(() => import("@/pages/TakafulManagementWorkspace"));
const WakalaInvestmentWorkspace = lazy(() => import("@/pages/WakalaInvestmentWorkspace"));
const AgentPerformanceWorkspace = lazy(() => import("@/pages/AgentPerformanceWorkspace"));
const WatchlistWorkspace = lazy(() => import("@/pages/WatchlistWorkspace"));
const SARReportsWorkspace = lazy(() => import("@/pages/SARReportsWorkspace"));
const PEPDatabaseWorkspace = lazy(() => import("@/pages/PEPDatabaseWorkspace"));
const CardTokensWorkspace = lazy(() => import("@/pages/CardTokensWorkspace"));
const CardFraudRulesWorkspace = lazy(() => import("@/pages/CardFraudRulesWorkspace"));
const StatementHistoryWorkspace = lazy(() => import("@/pages/StatementHistoryWorkspace"));
const WorkflowDefinitionsWorkspace = lazy(() => import("@/pages/WorkflowDefinitionsWorkspace"));
const WorkflowInstancesWorkspace = lazy(() => import("@/pages/WorkflowInstancesWorkspace"));
const SelfServiceTransactionsWorkspace = lazy(() => import("@/pages/SelfServiceTransactionsWorkspace"));
const ServiceHealthWorkspace = lazy(() => import("@/pages/ServiceHealthWorkspace"));
const MurabahaCalculatorWorkspace = lazy(() => import("@/pages/MurabahaCalculatorWorkspace"));
const LCAmendmentsWorkspace = lazy(() => import("@/pages/LCAmendmentsWorkspace"));
const ChequeImagingWorkspace = lazy(() => import("@/pages/ChequeImagingWorkspace"));
const IntegrationTestsWorkspace = lazy(() => import("@/pages/IntegrationTestsWorkspace"));
const SeedRegistryWorkspace = lazy(() => import("@/pages/SeedRegistryWorkspace"));
const InfraPostgresWorkspace = lazy(() => import("@/pages/InfraPostgresWorkspace"));
const InfraKafkaWorkspace = lazy(() => import("@/pages/InfraKafkaWorkspace"));
const InfraRedisWorkspace = lazy(() => import("@/pages/InfraRedisWorkspace"));
const InfraTemporalWorkspace = lazy(() => import("@/pages/InfraTemporalWorkspace"));
const InfraOpenSearchWorkspace = lazy(() => import("@/pages/InfraOpenSearchWorkspace"));
const InfraTigerBeetleWorkspace = lazy(() => import("@/pages/InfraTigerBeetleWorkspace"));
const InfraLakehouseWorkspace = lazy(() => import("@/pages/InfraLakehouseWorkspace"));
// Gap Closure — Batch 1 (CRITICAL)
const EODProcessorWorkspace = lazy(() => import("@/pages/EODProcessorWorkspace"));
const ProductFactoryWorkspace = lazy(() => import("@/pages/ProductFactoryWorkspace"));
const AccountingRulesWorkspace = lazy(() => import("@/pages/AccountingRulesWorkspace"));
const MakerCheckerWorkspace = lazy(() => import("@/pages/MakerCheckerWorkspace"));
const FXRevaluationWorkspace = lazy(() => import("@/pages/FXRevaluationWorkspace"));
const DBAdminWorkspace = lazy(() => import("@/pages/DBAdminWorkspace"));
// Gap Closure — Batch 2 (HIGH)
const CBNReturnsWorkspace = lazy(() => import("@/pages/CBNReturnsWorkspace"));
const CreditFacilitiesWorkspace = lazy(() => import("@/pages/CreditFacilitiesWorkspace"));
const StatementGeneratorWorkspace = lazy(() => import("@/pages/StatementGeneratorWorkspace"));
const RateCascadeWorkspace = lazy(() => import("@/pages/RateCascadeWorkspace"));
const LCRNSFRWorkspace = lazy(() => import("@/pages/LCRNSFRWorkspace"));
// Gap Closure — Batch 3 (MEDIUM)
const RelationshipPricingWorkspace = lazy(() => import("@/pages/RelationshipPricingWorkspace"));
const KafkaStreamingWorkspace = lazy(() => import("@/pages/KafkaStreamingWorkspace"));
const TemporalSagasWorkspace = lazy(() => import("@/pages/TemporalSagasWorkspace"));
const MandateManagementWorkspace = lazy(() => import("@/pages/MandateManagementWorkspace"));
const CIFManagementWorkspace = lazy(() => import("@/pages/CIFManagementWorkspace"));
const ExamManagementWorkspace = lazy(() => import("@/pages/ExamManagementWorkspace"));
// KYC/KYB — World-Class Identity Verification (PaddleOCR + Docling + VLM + Liveness + ArcFace)
const KYCEngineWorkspace = lazy(() => import("@/pages/KYCEngineWorkspace"));
const KYBEngineWorkspace = lazy(() => import("@/pages/KYBEngineWorkspace"));
const LivenessDetectionWorkspace = lazy(() => import("@/pages/LivenessDetectionWorkspace"));
const FaceMatchWorkspace = lazy(() => import("@/pages/FaceMatchWorkspace"));
const KYCTriggersWorkspace = lazy(() => import("@/pages/KYCTriggersWorkspace"));
const KYBTriggersWorkspace = lazy(() => import("@/pages/KYBTriggersWorkspace"));
const KYCEventRulesWorkspace = lazy(() => import("@/pages/KYCEventRulesWorkspace"));
const KYCServiceGatesWorkspace = lazy(() => import("@/pages/KYCServiceGatesWorkspace"));
const KYCOverridesWorkspace = lazy(() => import("@/pages/KYCOverridesWorkspace"));
const TenantIsolationWorkspace = lazy(() => import("@/pages/TenantIsolationWorkspace"));
const FeatureFlagEngineWorkspace = lazy(() => import("@/pages/FeatureFlagEngineWorkspace"));
const WhiteLabelEngineWorkspace = lazy(() => import("@/pages/WhiteLabelEngineWorkspace"));
const TenantProvisioningWorkspace = lazy(() => import("@/pages/TenantProvisioningWorkspace"));
const BrandedCommsWorkspace = lazy(() => import("@/pages/BrandedCommsWorkspace"));
const EventStreamingWorkspace = lazy(() => import("@/pages/EventStreamingWorkspace"));
const GraduatedRolloutWorkspace = lazy(() => import("@/pages/GraduatedRolloutWorkspace"));
const CustomDomainWorkspace = lazy(() => import("@/pages/CustomDomainWorkspace"));
const TenantMeteringWorkspace = lazy(() => import("@/pages/TenantMeteringWorkspace"));
const WebhookEngineWorkspace = lazy(() => import("@/pages/WebhookEngineWorkspace"));
const ApprovalWorkflowWorkspace = lazy(() => import("@/pages/ApprovalWorkflowWorkspace"));
const PluginMarketplaceWorkspace = lazy(() => import("@/pages/PluginMarketplaceWorkspace"));
const BillingOrchestratorWorkspace = lazy(() => import("@/pages/BillingOrchestratorWorkspace"));
const BillingRbacWorkspace = lazy(() => import("@/pages/BillingRbacWorkspace"));
const BillingEventProcessorWorkspace = lazy(() => import("@/pages/BillingEventProcessorWorkspace"));
const AdminAnalyticsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminAnalyticsPage })));
const AdminBankingOpsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminBankingOpsPage })));
const AdminFeatureFlagsPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminFeatureFlagsPage })));
const AdminSecurityPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminSecurityPage })));
const AdminUsersPage = lazy(() => import("@/pages/AdminModulePages").then((module) => ({ default: module.AdminUsersPage })));
const SecurityHardeningWorkspace = lazy(() => import("@/pages/SecurityHardeningWorkspace"));
const DDoSProtectionWorkspace = lazy(() => import("@/pages/DDoSProtectionWorkspace"));
const SwiftMessagingWorkspace = lazy(() => import("@/pages/SwiftMessagingWorkspace"));
const BranchOperationsWorkspace2 = lazy(() => import("@/pages/BranchOperationsWorkspace"));
const MicrofinanceEngineWorkspace = lazy(() => import("@/pages/MicrofinanceEngineWorkspace"));
const PBACEngineWorkspace = lazy(() => import("@/pages/PBACEngineWorkspace"));
const GLEngineWorkspace = lazy(() => import("@/pages/GLEngineWorkspace"));
const OfflineResilienceWorkspace = lazy(() => import("@/pages/OfflineResilienceWorkspace"));
const RegulatoryAutomationWorkspace = lazy(() => import("@/pages/RegulatoryAutomationWorkspace"));
const ServiceCatalogWorkspace = lazy(() => import("@/pages/ServiceCatalogWorkspace"));
const WhiteLabelConfigWorkspace = lazy(() => import("@/pages/WhiteLabelConfigWorkspace"));
const DatabasePersistenceWorkspace = lazy(() => import("@/pages/DatabasePersistenceWorkspace"));
const KafkaEventBusWorkspace = lazy(() => import("@/pages/KafkaEventBusWorkspace"));
const JWTAuthWorkspace = lazy(() => import("@/pages/JWTAuthWorkspace"));
const E2ETestSuiteWorkspace = lazy(() => import("@/pages/E2ETestSuiteWorkspace"));
const TigerBeetleLedgerWorkspace = lazy(() => import("@/pages/TigerBeetleLedgerWorkspace"));
const NotificationsWorkspace = lazy(() => import("@/pages/NotificationsWorkspace"));
const ReportGenerationWorkspace = lazy(() => import("@/pages/ReportGenerationWorkspace"));
const BatchEodWorkspace = lazy(() => import("@/pages/BatchEodWorkspace"));
const RateLimitingWorkspace = lazy(() => import("@/pages/RateLimitingWorkspace"));
const MultiCurrencyFxWorkspace = lazy(() => import("@/pages/MultiCurrencyFxWorkspace"));
const DisasterRecoveryWorkspace = lazy(() => import("@/pages/DisasterRecoveryWorkspace"));
const LoadTestingWorkspace = lazy(() => import("@/pages/LoadTestingWorkspace"));
const AIFraudDetectionWorkspace = lazy(() => import("@/pages/AIFraudDetectionWorkspace"));
const ENairaWorkspace = lazy(() => import("@/pages/ENairaWorkspace"));
const ESGBankingWorkspace = lazy(() => import("@/pages/ESGBankingWorkspace"));
const EmbeddedFinanceWorkspace = lazy(() => import("@/pages/EmbeddedFinanceWorkspace"));
const RansomwareProtectionWorkspace = lazy(() => import("@/pages/RansomwareProtectionWorkspace"));
const USSDBankingWorkspace = lazy(() => import("@/pages/USSDBankingWorkspace"));
const SMSBankingWorkspace = lazy(() => import("@/pages/SMSBankingWorkspace"));
const OfflineTransactionsWorkspace = lazy(() => import("@/pages/OfflineTransactionsWorkspace"));
const BandwidthAdaptationWorkspace = lazy(() => import("@/pages/BandwidthAdaptationWorkspace"));
const ResilienceDashboardWorkspace = lazy(() => import("@/pages/ResilienceDashboardWorkspace"));
const KPIDashboardWorkspace = lazy(() => import("@/pages/KPIDashboardWorkspace"));
const BranchPerformanceMapWorkspace = lazy(() => import("@/pages/BranchPerformanceMapWorkspace"));
const CircuitBreakerDashboardWorkspace = lazy(() => import("@/pages/CircuitBreakerDashboardWorkspace"));
const IdempotencyDashboardWorkspace = lazy(() => import("@/pages/IdempotencyDashboardWorkspace"));
const ErrorCatalogWorkspace = lazy(() => import("@/pages/ErrorCatalogWorkspace"));
const RetryPoliciesWorkspace = lazy(() => import("@/pages/RetryPoliciesWorkspace"));
const ErrorTelemetryWorkspace = lazy(() => import("@/pages/ErrorTelemetryWorkspace"));
const PerformanceCacheWorkspace = lazy(() => import("@/pages/PerformanceCacheWorkspace"));
const PerformanceMetricsWorkspace = lazy(() => import("@/pages/PerformanceMetricsWorkspace"));
const KedaAutoscalingWorkspace = lazy(() => import("@/pages/KedaAutoscalingWorkspace"));
const KedaPoliciesWorkspace = lazy(() => import("@/pages/KedaPoliciesWorkspace"));
const HAServicesWorkspace = lazy(() => import("@/pages/HAServicesWorkspace"));
const HAMiddlewareWorkspace = lazy(() => import("@/pages/HAMiddlewareWorkspace"));
const HAZonesWorkspace = lazy(() => import("@/pages/HAZonesWorkspace"));
const LakehouseDomainCDCWorkspace = lazy(() => import("@/pages/LakehouseDomainCDCWorkspace"));
const LakehouseCDCEventsWorkspace = lazy(() => import("@/pages/LakehouseCDCEventsWorkspace"));
const LakehouseClientsWorkspace = lazy(() => import("@/pages/LakehouseClientsWorkspace"));
const LakehouseQueryFederationWorkspace = lazy(() => import("@/pages/LakehouseQueryFederationWorkspace"));
const LakehouseMaterializedViewsWorkspace = lazy(() => import("@/pages/LakehouseMaterializedViewsWorkspace"));
const LakehouseLineageNodesWorkspace = lazy(() => import("@/pages/LakehouseLineageNodesWorkspace"));
const LakehouseLineageEdgesWorkspace = lazy(() => import("@/pages/LakehouseLineageEdgesWorkspace"));
const PgQueryProfilesWorkspace = lazy(() => import("@/pages/PgQueryProfilesWorkspace"));
const PgIndexAdvisoryWorkspace = lazy(() => import("@/pages/PgIndexAdvisoryWorkspace"));
const PgConnectionPoolsWorkspace = lazy(() => import("@/pages/PgConnectionPoolsWorkspace"));
const PgSlowQueriesWorkspace = lazy(() => import("@/pages/PgSlowQueriesWorkspace"));
const PgTableStatsWorkspace = lazy(() => import("@/pages/PgTableStatsWorkspace"));
const PgTuningParamsWorkspace = lazy(() => import("@/pages/PgTuningParamsWorkspace"));
const ApisixRoutesWorkspace = lazy(() => import("@/pages/ApisixRoutesWorkspace"));
const ApisixUpstreamsWorkspace = lazy(() => import("@/pages/ApisixUpstreamsWorkspace"));
const ApisixPluginsWorkspace = lazy(() => import("@/pages/ApisixPluginsWorkspace"));
const OpenappsecRulesWorkspace = lazy(() => import("@/pages/OpenappsecRulesWorkspace"));
const OpenappsecEventsWorkspace = lazy(() => import("@/pages/OpenappsecEventsWorkspace"));
const KeycloakRealmsWorkspace = lazy(() => import("@/pages/KeycloakRealmsWorkspace"));
const KeycloakClientsWorkspace = lazy(() => import("@/pages/KeycloakClientsWorkspace"));
const KeycloakRolesWorkspace = lazy(() => import("@/pages/KeycloakRolesWorkspace"));
const KeycloakIdPsWorkspace = lazy(() => import("@/pages/KeycloakIdPsWorkspace"));
const ServiceRegistryWorkspace = lazy(() => import("@/pages/ServiceRegistryWorkspace"));
const ProxyRoutesWorkspace = lazy(() => import("@/pages/ProxyRoutesWorkspace"));
const OtelConfigsWorkspace = lazy(() => import("@/pages/OtelConfigsWorkspace"));
const PrometheusMetricsWorkspace = lazy(() => import("@/pages/PrometheusMetricsWorkspace"));
const GrafanaDashboardsWorkspace = lazy(() => import("@/pages/GrafanaDashboardsWorkspace"));
const AlertRulesWorkspace = lazy(() => import("@/pages/AlertRulesWorkspace"));
const MojaloopCallbacksWorkspace = lazy(() => import("@/pages/MojaloopCallbacksWorkspace"));
const MojaloopCallbackEndpointsWorkspace = lazy(() => import("@/pages/MojaloopCallbackEndpointsWorkspace"));
const MojaloopILPPacketsWorkspace = lazy(() => import("@/pages/MojaloopILPPacketsWorkspace"));
const MojaloopSettlementWindowsWorkspace = lazy(() => import("@/pages/MojaloopSettlementWindowsWorkspace"));
const MojaloopSettlementModelsWorkspace = lazy(() => import("@/pages/MojaloopSettlementModelsWorkspace"));
const MojaloopAdminParticipantsWorkspace = lazy(() => import("@/pages/MojaloopAdminParticipantsWorkspace"));
const MojaloopAdminLimitsWorkspace = lazy(() => import("@/pages/MojaloopAdminLimitsWorkspace"));
const MojaloopCorridorsWorkspace = lazy(() => import("@/pages/MojaloopCorridorsWorkspace"));
const MojaloopTBBridgeEntriesWorkspace = lazy(() => import("@/pages/MojaloopTBBridgeEntriesWorkspace"));
const MojaloopTBBridgeConfigsWorkspace = lazy(() => import("@/pages/MojaloopTBBridgeConfigsWorkspace"));
const TBPGSyncConfigsWorkspace = lazy(() => import("@/pages/TBPGSyncConfigsWorkspace"));
const TBPGSyncEventsWorkspace = lazy(() => import("@/pages/TBPGSyncEventsWorkspace"));
const TBPGReconciliationRunsWorkspace = lazy(() => import("@/pages/TBPGReconciliationRunsWorkspace"));
const TBPGReconciliationRulesWorkspace = lazy(() => import("@/pages/TBPGReconciliationRulesWorkspace"));
const TBPGBalanceCacheConfigsWorkspace = lazy(() => import("@/pages/TBPGBalanceCacheConfigsWorkspace"));
const TBPGBalanceCacheEntriesWorkspace = lazy(() => import("@/pages/TBPGBalanceCacheEntriesWorkspace"));
const TBPGSagaDefinitionsWorkspace = lazy(() => import("@/pages/TBPGSagaDefinitionsWorkspace"));
const TBPGSagaExecutionsWorkspace = lazy(() => import("@/pages/TBPGSagaExecutionsWorkspace"));
/* Security Enhancement — 12 services */
const ScratchCardPINWorkspace = lazy(() => import("@/pages/ScratchCardPINWorkspace"));
const HSMKeyManagerWorkspace = lazy(() => import("@/pages/HSMKeyManagerWorkspace"));
const PINBlockEngineWorkspace = lazy(() => import("@/pages/PINBlockEngineWorkspace"));
const GridTokenCardWorkspace = lazy(() => import("@/pages/GridTokenCardWorkspace"));
const MFAOrchestratorWorkspace = lazy(() => import("@/pages/MFAOrchestratorWorkspace"));
const OTPHardeningWorkspace = lazy(() => import("@/pages/OTPHardeningWorkspace"));
const SessionSecurityWorkspace = lazy(() => import("@/pages/SessionSecurityWorkspace"));
const APIKeyVaultWorkspace = lazy(() => import("@/pages/APIKeyVaultWorkspace"));
const AdaptiveRateLimiterWorkspace = lazy(() => import("@/pages/AdaptiveRateLimiterWorkspace"));
const FieldLevelEncryptionWorkspace = lazy(() => import("@/pages/FieldLevelEncryptionWorkspace"));
const CertificateManagerWorkspace = lazy(() => import("@/pages/CertificateManagerWorkspace"));
const SecurityAuditLoggerWorkspace = lazy(() => import("@/pages/SecurityAuditLoggerWorkspace"));
const JWTValidatorWorkspace = lazy(() => import("@/pages/JWTValidatorWorkspace"));
const RouteSchemaEnforcerWorkspace = lazy(() => import("@/pages/RouteSchemaEnforcerWorkspace"));
const SQLParameterizerWorkspace = lazy(() => import("@/pages/SQLParameterizerWorkspace"));
const SecretsVaultWorkspace = lazy(() => import("@/pages/SecretsVaultWorkspace"));
const PINHasherWorkspace = lazy(() => import("@/pages/PINHasherWorkspace"));
const DockerHardenerWorkspace = lazy(() => import("@/pages/DockerHardenerWorkspace"));
const PKCEAuthFlowWorkspace = lazy(() => import("@/pages/PKCEAuthFlowWorkspace"));
const TokenRotationWorkspace = lazy(() => import("@/pages/TokenRotationWorkspace"));
const MTLSMeshWorkspace = lazy(() => import("@/pages/MTLSMeshWorkspace"));
const BodyLimitEnforcerWorkspace = lazy(() => import("@/pages/BodyLimitEnforcerWorkspace"));
const CloudKMSBridgeWorkspace = lazy(() => import("@/pages/CloudKMSBridgeWorkspace"));
const TLSTerminatorWorkspace = lazy(() => import("@/pages/TLSTerminatorWorkspace"));
const EventCorrelatorWorkspace = lazy(() => import("@/pages/EventCorrelatorWorkspace"));
const PCIScannerWorkspace = lazy(() => import("@/pages/PCIScannerWorkspace"));
const APIKeyEnforcerWorkspace = lazy(() => import("@/pages/APIKeyEnforcerWorkspace"));
const PathValidatorWorkspace = lazy(() => import("@/pages/PathValidatorWorkspace"));
const KeyRotationEngineWorkspace = lazy(() => import("@/pages/KeyRotationEngineWorkspace"));
const NetworkPolicyManagerWorkspace = lazy(() => import("@/pages/NetworkPolicyManagerWorkspace"));
const VaultIntegrationWorkspace = lazy(() => import("@/pages/VaultIntegrationWorkspace"));
const AnomalyDetectorWorkspace = lazy(() => import("@/pages/AnomalyDetectorWorkspace"));
const NDPRComplianceWorkspace = lazy(() => import("@/pages/NDPRComplianceWorkspace"));
const OutputEncoderWorkspace = lazy(() => import("@/pages/OutputEncoderWorkspace"));
const ImageScannerWorkspace = lazy(() => import("@/pages/ImageScannerWorkspace"));
const WAFRulesEngineWorkspace = lazy(() => import("@/pages/WAFRulesEngineWorkspace"));
const DDoSShieldWorkspace = lazy(() => import("@/pages/DDoSShieldWorkspace"));
const IPAllowlistWorkspace = lazy(() => import("@/pages/IPAllowlistWorkspace"));
const SIEMExporterWorkspace = lazy(() => import("@/pages/SIEMExporterWorkspace"));
const CBNComplianceCheckerWorkspace = lazy(() => import("@/pages/CBNComplianceCheckerWorkspace"));
const EgressControllerWorkspace = lazy(() => import("@/pages/EgressControllerWorkspace"));
const IncidentResponderWorkspace = lazy(() => import("@/pages/IncidentResponderWorkspace"));
const ImmutableAuditWorkspace = lazy(() => import("@/pages/ImmutableAuditWorkspace"));
const SOC2EvidenceWorkspace = lazy(() => import("@/pages/SOC2EvidenceWorkspace"));
const PentestOrchestratorWorkspace = lazy(() => import("@/pages/PentestOrchestratorWorkspace"));
const SRIValidatorWorkspace = lazy(() => import("@/pages/SRIValidatorWorkspace"));
const CSPNonceEngineWorkspace = lazy(() => import("@/pages/CSPNonceEngineWorkspace"));
const ClickjackDefenderWorkspace = lazy(() => import("@/pages/ClickjackDefenderWorkspace"));
const BrowserFingerprintWorkspace = lazy(() => import("@/pages/BrowserFingerprintWorkspace"));
const RedisCacheMiddlewareWorkspace = lazy(() => import("@/pages/RedisCacheMiddlewareWorkspace"));
const RedisSessionStoreWorkspace = lazy(() => import("@/pages/RedisSessionStoreWorkspace"));
const CacheInvalidationWorkspace = lazy(() => import("@/pages/CacheInvalidationWorkspace"));
const BloomFilterCacheWorkspace = lazy(() => import("@/pages/BloomFilterCacheWorkspace"));
const SortedSetRankingWorkspace = lazy(() => import("@/pages/SortedSetRankingWorkspace"));
const PgBouncerManagerWorkspace = lazy(() => import("@/pages/PgBouncerManagerWorkspace"));
const QueryCacheEngineWorkspace = lazy(() => import("@/pages/QueryCacheEngineWorkspace"));
const PreparedStmtCacheWorkspace = lazy(() => import("@/pages/PreparedStmtCacheWorkspace"));
const TablePartitionerWorkspace = lazy(() => import("@/pages/TablePartitionerWorkspace"));
const MaterializedViewEngineWorkspace = lazy(() => import("@/pages/MaterializedViewEngineWorkspace"));
const HotDataCacheWorkspace = lazy(() => import("@/pages/HotDataCacheWorkspace"));
const BatchAggregatorWorkspace = lazy(() => import("@/pages/BatchAggregatorWorkspace"));
const KeepaliveTunerWorkspace = lazy(() => import("@/pages/KeepaliveTunerWorkspace"));
const ResponseCompressorWorkspace = lazy(() => import("@/pages/ResponseCompressorWorkspace"));
const GRPCHotPathWorkspace = lazy(() => import("@/pages/GRPCHotPathWorkspace"));
const RouteTrieOptimizerWorkspace = lazy(() => import("@/pages/RouteTrieOptimizerWorkspace"));
const StreamResponseWorkspace = lazy(() => import("@/pages/StreamResponseWorkspace"));
const HTTP2MultiplexerWorkspace = lazy(() => import("@/pages/HTTP2MultiplexerWorkspace"));
const RequestCoalescerWorkspace = lazy(() => import("@/pages/RequestCoalescerWorkspace"));
const FastJSONSerializerWorkspace = lazy(() => import("@/pages/FastJSONSerializerWorkspace"));
const SWAPICacheWorkspace = lazy(() => import("@/pages/SWAPICacheWorkspace"));
const VirtualScrollEngineWorkspace = lazy(() => import("@/pages/VirtualScrollEngineWorkspace"));
const ComponentMemoizerWorkspace = lazy(() => import("@/pages/ComponentMemoizerWorkspace"));
const BundleSplitterWorkspace = lazy(() => import("@/pages/BundleSplitterWorkspace"));
const OptimisticUIEngineWorkspace = lazy(() => import("@/pages/OptimisticUIEngineWorkspace"));
const KafkaConsumerOptimizerWorkspace = lazy(() => import("@/pages/KafkaConsumerOptimizerWorkspace"));
const KafkaBatchProducerWorkspace = lazy(() => import("@/pages/KafkaBatchProducerWorkspace"));
const AvroSchemaRegistryWorkspace = lazy(() => import("@/pages/AvroSchemaRegistryWorkspace"));
const FluvioWASMTransformWorkspace = lazy(() => import("@/pages/FluvioWASMTransformWorkspace"));
const EventDedupEngineWorkspace = lazy(() => import("@/pages/EventDedupEngineWorkspace"));
const DistrolessBuilderWorkspace = lazy(() => import("@/pages/DistrolessBuilderWorkspace"));
const TigerBeetleBatchWorkspace = lazy(() => import("@/pages/TigerBeetleBatchWorkspace"));
const HPAAutoscalerWorkspace = lazy(() => import("@/pages/HPAAutoscalerWorkspace"));
const CDNEdgeCacheWorkspace = lazy(() => import("@/pages/CDNEdgeCacheWorkspace"));
const ReadReplicaRouterWorkspace = lazy(() => import("@/pages/ReadReplicaRouterWorkspace"));
const KEDAScalerWorkspace = lazy(() => import("@/pages/KEDAScalerWorkspace"));
const PrometheusDashboardWorkspace = lazy(() => import("@/pages/PrometheusDashboardWorkspace"));
const OpenSearchOptimizerWorkspace = lazy(() => import("@/pages/OpenSearchOptimizerWorkspace"));
const TemporalMemoizerWorkspace = lazy(() => import("@/pages/TemporalMemoizerWorkspace"));
const APISIXPluginOptimizerWorkspace = lazy(() => import("@/pages/APISIXPluginOptimizerWorkspace"));
const AMLRiskScoringWorkspace = lazy(() => import("@/pages/AMLRiskScoringWorkspace"));
const SARFilingEngineWorkspace = lazy(() => import("@/pages/SARFilingEngineWorkspace"));
const CTRAutoFilerWorkspace = lazy(() => import("@/pages/CTRAutoFilerWorkspace"));
const AMLCaseManagerWorkspace = lazy(() => import("@/pages/AMLCaseManagerWorkspace"));
const WatchlistManagerWorkspace = lazy(() => import("@/pages/WatchlistManagerWorkspace"));
const AdverseMediaScannerWorkspace = lazy(() => import("@/pages/AdverseMediaScannerWorkspace"));
const BeneficialOwnershipWorkspace = lazy(() => import("@/pages/BeneficialOwnershipWorkspace"));
const TxnPatternAnalyzerWorkspace = lazy(() => import("@/pages/TxnPatternAnalyzerWorkspace"));
const GoAMLIntegrationWorkspace = lazy(() => import("@/pages/GoAMLIntegrationWorkspace"));
const AMLComplianceDashboardWorkspace = lazy(() => import("@/pages/AMLComplianceDashboardWorkspace"));
const SanctionsBatchRescreenerWorkspace = lazy(() => import("@/pages/SanctionsBatchRescreenerWorkspace"));
const AMLTrainingTrackerWorkspace = lazy(() => import("@/pages/AMLTrainingTrackerWorkspace"));
const WireTransferMonitorWorkspace = lazy(() => import("@/pages/WireTransferMonitorWorkspace"));
const AMLRegulatoryReportingWorkspace = lazy(() => import("@/pages/AMLRegulatoryReportingWorkspace"));
const TypologyDetectorWorkspace = lazy(() => import("@/pages/TypologyDetectorWorkspace"));

// Agriculture Enhancement (40 services)
const CooperativeManagementWorkspace = lazy(() => import("@/pages/CooperativeManagementWorkspace"));
const LivestockManagementWorkspace = lazy(() => import("@/pages/LivestockManagementWorkspace"));
const AgriInputMarketplaceWorkspace = lazy(() => import("@/pages/AgriInputMarketplaceWorkspace"));
const NirsalCreditGuaranteeWorkspace = lazy(() => import("@/pages/NirsalCreditGuaranteeWorkspace"));
const CbnAnchorBorrowersWorkspace = lazy(() => import("@/pages/CbnAnchorBorrowersWorkspace"));
const InteractiveUssdAgriWorkspace = lazy(() => import("@/pages/InteractiveUssdAgriWorkspace"));
const AgriSavingsCyclesWorkspace = lazy(() => import("@/pages/AgriSavingsCyclesWorkspace"));
const LivestockFinanceWorkspace = lazy(() => import("@/pages/LivestockFinanceWorkspace"));
const CommodityExchangeWorkspace = lazy(() => import("@/pages/CommodityExchangeWorkspace"));
const AgriEvoucherWorkspace = lazy(() => import("@/pages/AgriEvoucherWorkspace"));
const CommodityPriceIntelligenceWorkspace = lazy(() => import("@/pages/CommodityPriceIntelligenceWorkspace"));
const SatelliteCropMonitorWorkspace = lazy(() => import("@/pages/SatelliteCropMonitorWorkspace"));
const CooperativeCreditScoringWorkspace = lazy(() => import("@/pages/CooperativeCreditScoringWorkspace"));
const FisheriesAquacultureWorkspace = lazy(() => import("@/pages/FisheriesAquacultureWorkspace"));
const FarmBoundaryMappingWorkspace = lazy(() => import("@/pages/FarmBoundaryMappingWorkspace"));
const AreaYieldIndexInsuranceWorkspace = lazy(() => import("@/pages/AreaYieldIndexInsuranceWorkspace"));
const WarehouseManagementWorkspace = lazy(() => import("@/pages/WarehouseManagementWorkspace"));
const AgentFarmerOnboardingWorkspace = lazy(() => import("@/pages/AgentFarmerOnboardingWorkspace"));
const LivestockInsuranceWorkspace = lazy(() => import("@/pages/LivestockInsuranceWorkspace"));
const EquipmentLeasingWorkspace = lazy(() => import("@/pages/EquipmentLeasingWorkspace"));
const CropYieldPredictionWorkspace = lazy(() => import("@/pages/CropYieldPredictionWorkspace"));
const MultiPerilCropInsuranceWorkspace = lazy(() => import("@/pages/MultiPerilCropInsuranceWorkspace"));
const AgriLogisticsWorkspace = lazy(() => import("@/pages/AgriLogisticsWorkspace"));
const CbnAgriReturnsWorkspace = lazy(() => import("@/pages/CbnAgriReturnsWorkspace"));
const AnimalIdTraceabilityWorkspace = lazy(() => import("@/pages/AnimalIdTraceabilityWorkspace"));
const NirsalAgroGeocoopWorkspace = lazy(() => import("@/pages/NirsalAgroGeocoopWorkspace"));
const AgriIotSensorWorkspace = lazy(() => import("@/pages/AgriIotSensorWorkspace"));
const AgriReinsuranceWorkspace = lazy(() => import("@/pages/AgriReinsuranceWorkspace"));
const QualityCertificationWorkspace = lazy(() => import("@/pages/QualityCertificationWorkspace"));
const AgriEsgImpactWorkspace = lazy(() => import("@/pages/AgriEsgImpactWorkspace"));
const CrossborderAgriTradeWorkspace = lazy(() => import("@/pages/CrossborderAgriTradeWorkspace"));
const CooperativeMeetingsWorkspace = lazy(() => import("@/pages/CooperativeMeetingsWorkspace"));
const CooperativeFinancialsWorkspace = lazy(() => import("@/pages/CooperativeFinancialsWorkspace"));
const SoilAnalysisWorkspace = lazy(() => import("@/pages/SoilAnalysisWorkspace"));
const InsurancePortfolioAnalyticsWorkspace = lazy(() => import("@/pages/InsurancePortfolioAnalyticsWorkspace"));
const ParametricInsuranceIotWorkspace = lazy(() => import("@/pages/ParametricInsuranceIotWorkspace"));
const PostHarvestLossTrackerWorkspace = lazy(() => import("@/pages/PostHarvestLossTrackerWorkspace"));
const AggregationCenterWorkspace = lazy(() => import("@/pages/AggregationCenterWorkspace"));
const CbnAgsmeisWorkspace = lazy(() => import("@/pages/CbnAgsmeisWorkspace"));
const AcgsfGuaranteeWorkspace = lazy(() => import("@/pages/AcgsfGuaranteeWorkspace"));

// Channel Banking (25 services)
const VoiceBankingGatewayWorkspace = lazy(() => import("@/pages/VoiceBankingGatewayWorkspace"));
const VoiceTtsNigerianWorkspace = lazy(() => import("@/pages/VoiceTtsNigerianWorkspace"));
const VoiceAsrNigerianWorkspace = lazy(() => import("@/pages/VoiceAsrNigerianWorkspace"));
const VoiceNluBankingWorkspace = lazy(() => import("@/pages/VoiceNluBankingWorkspace"));
const VoiceBiometricAuthWorkspace = lazy(() => import("@/pages/VoiceBiometricAuthWorkspace"));
const VoiceIvrMenuWorkspace = lazy(() => import("@/pages/VoiceIvrMenuWorkspace"));
const VoiceCallAnalyticsWorkspace = lazy(() => import("@/pages/VoiceCallAnalyticsWorkspace"));
const VoiceAgentEscalationWorkspace = lazy(() => import("@/pages/VoiceAgentEscalationWorkspace"));
const TelegramBotGatewayWorkspace = lazy(() => import("@/pages/TelegramBotGatewayWorkspace"));
const TelegramBankingCommandsWorkspace = lazy(() => import("@/pages/TelegramBankingCommandsWorkspace"));
const TelegramNotificationWorkspace = lazy(() => import("@/pages/TelegramNotificationWorkspace"));
const TelegramMiniAppWorkspace = lazy(() => import("@/pages/TelegramMiniAppWorkspace"));
const TelegramKycBotWorkspace = lazy(() => import("@/pages/TelegramKycBotWorkspace"));
const WhatsappBusinessGatewayWorkspace = lazy(() => import("@/pages/WhatsappBusinessGatewayWorkspace"));
const WhatsappBankingFlowsWorkspace = lazy(() => import("@/pages/WhatsappBankingFlowsWorkspace"));
const WhatsappPaymentIntegrationWorkspace = lazy(() => import("@/pages/WhatsappPaymentIntegrationWorkspace"));
const WhatsappNotificationWorkspace = lazy(() => import("@/pages/WhatsappNotificationWorkspace"));
const WhatsappDocumentServiceWorkspace = lazy(() => import("@/pages/WhatsappDocumentServiceWorkspace"));
const UssdBankingGatewayWorkspace = lazy(() => import("@/pages/UssdBankingGatewayWorkspace"));
const UssdTransactionEngineWorkspace = lazy(() => import("@/pages/UssdTransactionEngineWorkspace"));
const UssdMultilingualWorkspace = lazy(() => import("@/pages/UssdMultilingualWorkspace"));
const UssdSimToolkitWorkspace = lazy(() => import("@/pages/UssdSimToolkitWorkspace"));
const SmsBankingGatewayWorkspace = lazy(() => import("@/pages/SmsBankingGatewayWorkspace"));
const SmsOtpServiceWorkspace = lazy(() => import("@/pages/SmsOtpServiceWorkspace"));
const SmsAlertNotificationWorkspace = lazy(() => import("@/pages/SmsAlertNotificationWorkspace"));

function RouteFallback() {
  return <div className="min-h-screen bg-slate-50" />;
}

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <ArchiveAdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function renderInAdminShell(Page: ComponentType) {
  return () => (
    <AdminShell>
      <Page />
    </AdminShell>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => { setAuthUser(data.user); setAuthChecked(true); })
        .catch(() => { localStorage.removeItem("access_token"); setAuthChecked(true); });
    } else {
      setAuthChecked(true);
    }
  }, []);

  if (!authChecked) {
    return <RouteFallback />;
  }

  if (!authUser) {
    return <LoginPage onLogin={(user, token) => { setAuthUser(user); }} />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/login" component={AdminLoginPage} />

        <Route path="/customer/dashboard" component={CustomerDashboard} />
        <Route path="/customer/transfers" component={CustomerTransfers} />
        <Route path="/customer/cards" component={CustomerCards} />
        <Route path="/customer/savings" component={CustomerSavings} />
        <Route path="/customer/loans" component={CustomerLoans} />
        <Route path="/customer/bills" component={CustomerBills} />
        <Route path="/customer/statements" component={CustomerStatements} />
        <Route path="/customer/notifications" component={CustomerNotifications} />
        <Route path="/customer/settings" component={CustomerSettings} />
        <Route path="/customer/qr" component={CustomerQr} />

        <Route path="/" component={renderInAdminShell(AdminDashboard)} />
        <Route path="/banks" component={renderInAdminShell(AdminBanksPage)} />
        <Route path="/features" component={renderInAdminShell(AdminFeatureFlagsPage)} />
        <Route path="/billing" component={renderInAdminShell(AdminBillingPage)} />
        <Route path="/billing-engine" component={renderInAdminShell(BillingEngineWorkspace)} />
        <Route path="/pricing-model" component={renderInAdminShell(PricingModelWorkspace)} />
        <Route path="/monitoring" component={renderInAdminShell(AdminMonitoringPage)} />
        <Route path="/usage-analytics" component={renderInAdminShell(AdminUsageAnalyticsPage)} />
        <Route path="/alert-settings" component={renderInAdminShell(AdminAlertSettingsPage)} />
        <Route path="/alerts" component={renderInAdminShell(AdminAlertsPage)} />
        <Route path="/alert-rules" component={renderInAdminShell(AdminAlertRulesPage)} />
        <Route path="/group-lending" component={renderInAdminShell(AdminGroupLendingPage)} />
        <Route path="/agent-banking" component={renderInAdminShell(AdminAgentBankingPage)} />
        <Route path="/regulatory-reporting" component={renderInAdminShell(AdminRegulatoryReportingPage)} />
        <Route path="/onboarding" component={renderInAdminShell(PartnerOnboardingAdminPage)} />
        <Route path="/partner/onboarding" component={PartnerOnboardingPortalPage} />
        <Route path="/home" component={renderInAdminShell(AdminDashboard)} />
        <Route path="/curriculum" component={renderInAdminShell(AdminCurriculumPage)} />
        <Route path="/infrastructure" component={renderInAdminShell(AdminInfrastructurePage)} />
        <Route path="/resources" component={renderInAdminShell(AdminResourcesPage)} />
        <Route path="/quick-reference" component={renderInAdminShell(AdminQuickReferencePage)} />
        <Route path="/labs" component={renderInAdminShell(AdminLabsPage)} />
        <Route path="/agriculture" component={renderInAdminShell(AgricultureOverviewPage)} />
        <Route path="/agriculture/farmers" component={renderInAdminShell(AgricultureFarmersPage)} />
        <Route path="/agriculture/loans" component={renderInAdminShell(AgricultureLoansPage)} />
        <Route path="/agriculture/risk" component={renderInAdminShell(AgricultureRiskPage)} />
        <Route path="/agriculture/agtech" component={renderInAdminShell(AgricultureAgtechPage)} />
        <Route path="/agriculture/value-chain" component={renderInAdminShell(AgricultureValueChainPage)} />
        <Route path="/agriculture/regulatory" component={renderInAdminShell(AgricultureCompliancePage)} />
        <Route path="/agriculture/compliance" component={renderInAdminShell(AgricultureCompliancePage)} />
        <Route path="/agriculture/analytics" component={renderInAdminShell(AgricultureAnalyticsPage)} />

        <Route path="/admin" component={renderInAdminShell(AdminDashboard)} />
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin/feature-flags" component={renderInAdminShell(AdminFeatureFlagsPage)} />
        <Route path="/admin/features" component={renderInAdminShell(AdminFeatureFlagsPage)} />
        <Route path="/admin/security" component={renderInAdminShell(AdminSecurityPage)} />
        <Route path="/admin/banking" component={renderInAdminShell(AdminBankingOpsPage)} />
        <Route path="/admin/analytics" component={renderInAdminShell(AdminAnalyticsPage)} />
        <Route path="/admin/users" component={renderInAdminShell(AdminUsersPage)} />
        <Route path="/admin/banks" component={renderInAdminShell(AdminBanksPage)} />
        <Route path="/admin/billing" component={renderInAdminShell(AdminBillingPage)} />
        <Route path="/admin/billing-engine" component={renderInAdminShell(BillingEngineWorkspace)} />
        <Route path="/admin/pricing-model" component={renderInAdminShell(PricingModelWorkspace)} />
        <Route path="/admin/monitoring" component={renderInAdminShell(AdminMonitoringPage)} />
        <Route path="/admin/usage-analytics" component={renderInAdminShell(AdminUsageAnalyticsPage)} />
        <Route path="/admin/alerts" component={renderInAdminShell(AdminAlertsPage)} />
        <Route path="/admin/alert-settings" component={renderInAdminShell(AdminAlertSettingsPage)} />
        <Route path="/admin/alert-rules" component={renderInAdminShell(AdminAlertRulesPage)} />
        <Route path="/admin/group-lending" component={renderInAdminShell(AdminGroupLendingPage)} />
        <Route path="/admin/agent-banking" component={renderInAdminShell(AdminAgentBankingPage)} />
        <Route path="/admin/regulatory-reporting" component={renderInAdminShell(AdminRegulatoryReportingPage)} />
        <Route path="/admin/onboarding" component={renderInAdminShell(PartnerOnboardingAdminPage)} />
        <Route path="/admin/curriculum" component={renderInAdminShell(AdminCurriculumPage)} />
        <Route path="/admin/infrastructure" component={renderInAdminShell(AdminInfrastructurePage)} />
        <Route path="/admin/resources" component={renderInAdminShell(AdminResourcesPage)} />
        <Route path="/admin/quick-reference" component={renderInAdminShell(AdminQuickReferencePage)} />
        <Route path="/admin/labs" component={renderInAdminShell(AdminLabsPage)} />

        <Route path="/control-center" component={renderInAdminShell(Home)} />
        <Route path="/operations" component={renderInAdminShell(OperationsCenter)} />
        <Route path="/teller" component={renderInAdminShell(TellerWorkspace)} />
        <Route path="/trade-finance" component={renderInAdminShell(TradeFinanceWorkspace)} />
        <Route path="/mortgage" component={renderInAdminShell(MortgageWorkspace)} />
        <Route path="/education-loans" component={renderInAdminShell(EducationLoansWorkspace)} />
        <Route path="/esusu" component={renderInAdminShell(EsusuWorkspace)} />
        <Route path="/virtual-accounts" component={renderInAdminShell(VirtualAccountsWorkspace)} />
        <Route path="/disputes" component={renderInAdminShell(DisputeManagementWorkspace)} />
        <Route path="/agricultural-insurance" component={renderInAdminShell(AgricultureOverviewPage)} />
        <Route path="/ledger-sync" component={renderInAdminShell(LedgerSyncWorkspace)} />
        <Route path="/erpnext-sync" component={renderInAdminShell(ERPNextWorkspace)} />
        <Route path="/identity-channels" component={renderInAdminShell(IdentityChannelsWorkspace)} />
        <Route path="/islamic-banking" component={renderInAdminShell(IslamicBankingWorkspace)} />
        <Route path="/payments-hub" component={renderInAdminShell(PaymentsHubWorkspace)} />
        <Route path="/savings-products" component={renderInAdminShell(SavingsProductsWorkspace)} />
        <Route path="/card-management" component={renderInAdminShell(CardManagementWorkspace)} />
        <Route path="/treasury" component={renderInAdminShell(TreasuryWorkspace)} />
        <Route path="/customer-engagement" component={renderInAdminShell(CustomerEngagementWorkspace)} />
        <Route path="/fraud-detection" component={renderInAdminShell(FraudDetectionWorkspace)} />
        <Route path="/notification-center" component={renderInAdminShell(NotificationCenterWorkspace)} />
        <Route path="/account-opening" component={renderInAdminShell(AccountOpeningWorkspace)} />
        <Route path="/standing-orders" component={renderInAdminShell(StandingOrdersWorkspace)} />
        <Route path="/beneficiary-management" component={renderInAdminShell(BeneficiaryManagementWorkspace)} />
        <Route path="/loan-calculator" component={renderInAdminShell(LoanCalculatorWorkspace)} />
        <Route path="/batch-processing" component={renderInAdminShell(BatchProcessingWorkspace)} />
        <Route path="/fx-rates" component={renderInAdminShell(FXRatesWorkspace)} />
        <Route path="/branch-operations" component={renderInAdminShell(BranchOperationsWorkspace)} />
        <Route path="/ledger" component={renderInAdminShell(LedgerWorkspace)} />
        <Route path="/event-bus" component={renderInAdminShell(EventBusWorkspace)} />
        <Route path="/workflow-engine" component={renderInAdminShell(WorkflowEngineWorkspace)} />
        <Route path="/mojaloop" component={renderInAdminShell(MojaloopWorkspace)} />
        <Route path="/opensearch" component={renderInAdminShell(OpenSearchWorkspace)} />
        <Route path="/lakehouse" component={renderInAdminShell(LakehouseWorkspace)} />
        <Route path="/fluvio-streams" component={renderInAdminShell(FluvioStreamsWorkspace)} />
        <Route path="/dapr" component={renderInAdminShell(DaprSidecarWorkspace)} />
        <Route path="/permify" component={renderInAdminShell(PermifyWorkspace)} />
        <Route path="/keycloak" component={renderInAdminShell(KeycloakWorkspace)} />
        <Route path="/interest-rates" component={renderInAdminShell(InterestRateWorkspace)} />
        <Route path="/cheque-clearing" component={renderInAdminShell(ChequeClearingWorkspace)} />
        <Route path="/customer-360" component={renderInAdminShell(Customer360Workspace)} />
        <Route path="/nibss-direct-debit" component={renderInAdminShell(NIBSSDirectDebitWorkspace)} />
        <Route path="/diaspora-banking" component={renderInAdminShell(DiasporaBankingWorkspace)} />
        <Route path="/kyc-aml" component={renderInAdminShell(KYCAMLWorkspace)} />
        <Route path="/loan-origination" component={renderInAdminShell(LoanOriginationWorkspace)} />
        <Route path="/account-statements" component={renderInAdminShell(AccountStatementsWorkspace)} />
        <Route path="/bulk-payments" component={renderInAdminShell(BulkPaymentsWorkspace)} />
        <Route path="/card-management-v2" component={renderInAdminShell(CardManagementWorkspace2)} />
        <Route path="/treasury-liquidity" component={renderInAdminShell(TreasuryLiquidityWorkspace)} />
        <Route path="/agent-banking-v2" component={renderInAdminShell(AgentBankingWorkspace2)} />
        <Route path="/chart-of-accounts" component={renderInAdminShell(ChartOfAccountsWorkspace)} />
        <Route path="/journal-entries" component={renderInAdminShell(JournalEntriesWorkspace)} />
        <Route path="/reporting" component={renderInAdminShell(ReportingWorkspace)} />
        <Route path="/payment-transactions" component={renderInAdminShell(PaymentTransactionsWorkspace)} />
        <Route path="/loan-products" component={renderInAdminShell(LoanProductsWorkspace)} />
        <Route path="/loan-accounts" component={renderInAdminShell(LoanAccountsWorkspace)} />
        <Route path="/analytics" component={renderInAdminShell(AnalyticsWidgetsWorkspace)} />
        <Route path="/etl-pipelines" component={renderInAdminShell(ETLPipelinesWorkspace)} />
        <Route path="/fraud-rules" component={renderInAdminShell(FraudRulesWorkspace)} />
        <Route path="/fraud-alerts" component={renderInAdminShell(FraudAlertsWorkspace)} />
        <Route path="/webhook-subscriptions" component={renderInAdminShell(WebhookSubscriptionsWorkspace)} />
        <Route path="/webhook-deliveries" component={renderInAdminShell(WebhookDeliveriesWorkspace)} />
        <Route path="/audit-trail" component={renderInAdminShell(AuditTrailWorkspace)} />
        <Route path="/compliance-checks" component={renderInAdminShell(ComplianceChecksWorkspace)} />
        <Route path="/regulatory-calendar" component={renderInAdminShell(RegulatoryCalendarWorkspace)} />
        <Route path="/customer-onboarding" component={renderInAdminShell(CustomerOnboardingWorkspace)} />
        <Route path="/fx-dealing-room" component={renderInAdminShell(FXDealingRoomWorkspace)} />
        <Route path="/fx-positions" component={renderInAdminShell(FXPositionsWorkspace)} />
        <Route path="/doc-collections" component={renderInAdminShell(DocCollectionsWorkspace)} />
        <Route path="/treasury-investments" component={renderInAdminShell(TreasuryInvestmentsWorkspace)} />
        <Route path="/swift-messages" component={renderInAdminShell(SWIFTMessagesWorkspace)} />
        <Route path="/credit-risk" component={renderInAdminShell(CreditRiskWorkspace)} />
        <Route path="/reconciliation" component={renderInAdminShell(ReconciliationWorkspace)} />
        <Route path="/fee-schedules" component={renderInAdminShell(FeeSchedulesWorkspace)} />
        <Route path="/notification-preferences" component={renderInAdminShell(NotificationPreferencesWorkspace)} />
        <Route path="/dormancy" component={renderInAdminShell(DormancyWorkspace)} />
        <Route path="/interest-accrual" component={renderInAdminShell(InterestAccrualWorkspace)} />
        <Route path="/limit-management" component={renderInAdminShell(LimitManagementWorkspace)} />
        <Route path="/gl-accounts" component={renderInAdminShell(GLAccountsWorkspace)} />
        <Route path="/collateral" component={renderInAdminShell(CollateralWorkspace)} />
        <Route path="/complaints" component={renderInAdminShell(ComplaintsWorkspace)} />
        <Route path="/interbank-settlement" component={renderInAdminShell(InterbankSettlementWorkspace)} />
        <Route path="/staff-management" component={renderInAdminShell(StaffManagementWorkspace)} />
        <Route path="/channel-management" component={renderInAdminShell(ChannelManagementWorkspace)} />
        <Route path="/fixed-deposits" component={renderInAdminShell(FixedDepositsWorkspace)} />
        <Route path="/standing-instructions" component={renderInAdminShell(StandingInstructionsWorkspace)} />
        <Route path="/cash-management" component={renderInAdminShell(CashManagementWorkspace)} />
        <Route path="/correspondent-banking" component={renderInAdminShell(CorrespondentBankingWorkspace)} />
        <Route path="/product-catalog" component={renderInAdminShell(ProductCatalogWorkspace)} />
        <Route path="/customer-segments" component={renderInAdminShell(CustomerSegmentsWorkspace)} />
        <Route path="/messaging-gateway" component={renderInAdminShell(SMSEmailGatewayWorkspace)} />
        <Route path="/risk-scoring" component={renderInAdminShell(RiskScoringWorkspace)} />
        <Route path="/regulatory-reporting" component={renderInAdminShell(RegulatoryReportingWorkspace)} />
        <Route path="/atm-management" component={renderInAdminShell(ATMManagementWorkspace)} />
        <Route path="/data-export" component={renderInAdminShell(DataExportWorkspace)} />
        <Route path="/customer-insights" component={renderInAdminShell(CustomerInsightsWorkspace)} />
        <Route path="/salary-processing" component={renderInAdminShell(SalaryProcessingWorkspace)} />
        <Route path="/credit-bureau" component={renderInAdminShell(CreditBureauWorkspace)} />
        <Route path="/document-management" component={renderInAdminShell(DocumentManagementWorkspace)} />
        <Route path="/pos-terminals" component={renderInAdminShell(POSTerminalWorkspace)} />
        <Route path="/collateral-valuation" component={renderInAdminShell(CollateralValuationWorkspace)} />
        <Route path="/customer-feedback" component={renderInAdminShell(CustomerFeedbackWorkspace)} />
        <Route path="/money-market" component={renderInAdminShell(MoneyMarketWorkspace)} />
        <Route path="/securities-trading" component={renderInAdminShell(SecuritiesTradingWorkspace)} />
        <Route path="/supply-chain-finance" component={renderInAdminShell(SupplyChainFinanceWorkspace)} />
        <Route path="/cash-pooling" component={renderInAdminShell(CashPoolingWorkspace)} />
        <Route path="/bank-guarantees" component={renderInAdminShell(BankGuaranteesWorkspace)} />
        <Route path="/otc-derivatives" component={renderInAdminShell(OtcDerivativesWorkspace)} />
        <Route path="/iso20022-hub" component={renderInAdminShell(ISO20022HubWorkspace)} />
        <Route path="/basel-engine" component={renderInAdminShell(BaselEngineWorkspace)} />
        <Route path="/ifrs9-engine" component={renderInAdminShell(IFRS9EngineWorkspace)} />
        <Route path="/open-banking" component={renderInAdminShell(OpenBankingWorkspace)} />
        <Route path="/interbank-lending" component={renderInAdminShell(InterbankLendingWorkspace)} />
        <Route path="/portfolio-mgmt" component={renderInAdminShell(PortfolioMgmtWorkspace)} />
        <Route path="/wealth-mgmt" component={renderInAdminShell(WealthMgmtWorkspace)} />
        <Route path="/custody-service" component={renderInAdminShell(CustodyServiceWorkspace)} />
        <Route path="/factoring" component={renderInAdminShell(FactoringWorkspace)} />
        <Route path="/syndicated-loans" component={renderInAdminShell(SyndicatedLoansWorkspace)} />
        <Route path="/project-finance" component={renderInAdminShell(ProjectFinanceWorkspace)} />
        <Route path="/leasing" component={renderInAdminShell(LeasingWorkspace)} />
        <Route path="/contingent-liabilities" component={renderInAdminShell(ContingentLiabilitiesWorkspace)} />
        <Route path="/etd-trading" component={renderInAdminShell(ETDTradingWorkspace)} />
        <Route path="/payment-investigation" component={renderInAdminShell(PaymentInvestigationWorkspace)} />
        <Route path="/stress-testing" component={renderInAdminShell(StressTestingWorkspace)} />
        <Route path="/api-marketplace" component={renderInAdminShell(APIMarketplaceWorkspace)} />
        <Route path="/chatbot" component={renderInAdminShell(ChatbotWorkspace)} />
        <Route path="/growth-features" component={renderInAdminShell(GrowthFeaturesWorkspace)} />
        <Route path="/signature-verification" component={renderInAdminShell(SignatureVerificationWorkspace)} />
        <Route path="/remittance" component={renderInAdminShell(RemittanceWorkspace)} />
        <Route path="/microfinance" component={renderInAdminShell(MicrofinanceWorkspace)} />
        <Route path="/utility-payments" component={renderInAdminShell(UtilityPaymentsWorkspace)} />
        <Route path="/multi-entity" component={renderInAdminShell(MultiEntityWorkspace)} />
        <Route path="/trust-estate" component={renderInAdminShell(TrustEstateWorkspace)} />
        <Route path="/escrow" component={renderInAdminShell(EscrowWorkspace)} />
        <Route path="/qr-payments" component={renderInAdminShell(QRPaymentsWorkspace)} />
        <Route path="/fatca-crs" component={renderInAdminShell(FATCACRSWorkspace)} />
        <Route path="/biometric-auth" component={renderInAdminShell(BiometricAuthWorkspace)} />
        <Route path="/safe-deposit" component={renderInAdminShell(SafeDepositWorkspace)} />
        <Route path="/fixed-assets" component={renderInAdminShell(FixedAssetsWorkspace)} />
        <Route path="/expense-mgmt" component={renderInAdminShell(ExpenseMgmtWorkspace)} />
        <Route path="/inventory" component={renderInAdminShell(InventoryWorkspace)} />
        <Route path="/insurance" component={renderInAdminShell(InsuranceWorkspace)} />
        <Route path="/pension" component={renderInAdminShell(PensionWorkspace)} />
        <Route path="/locker" component={renderInAdminShell(LockerWorkspace)} />
        <Route path="/standing-charges" component={renderInAdminShell(StandingChargesWorkspace)} />
        <Route path="/sukuk-management" component={renderInAdminShell(SukukManagementWorkspace)} />
        <Route path="/takaful-management" component={renderInAdminShell(TakafulManagementWorkspace)} />
        <Route path="/wakala-investments" component={renderInAdminShell(WakalaInvestmentWorkspace)} />
        <Route path="/agent-performance" component={renderInAdminShell(AgentPerformanceWorkspace)} />
        <Route path="/watchlist-screening" component={renderInAdminShell(WatchlistWorkspace)} />
        <Route path="/sar-reports" component={renderInAdminShell(SARReportsWorkspace)} />
        <Route path="/pep-database" component={renderInAdminShell(PEPDatabaseWorkspace)} />
        <Route path="/card-tokens" component={renderInAdminShell(CardTokensWorkspace)} />
        <Route path="/card-fraud-rules" component={renderInAdminShell(CardFraudRulesWorkspace)} />
        <Route path="/statement-history" component={renderInAdminShell(StatementHistoryWorkspace)} />
        <Route path="/workflow-definitions" component={renderInAdminShell(WorkflowDefinitionsWorkspace)} />
        <Route path="/workflow-instances" component={renderInAdminShell(WorkflowInstancesWorkspace)} />
        <Route path="/my-transactions" component={renderInAdminShell(SelfServiceTransactionsWorkspace)} />
        <Route path="/service-health" component={renderInAdminShell(ServiceHealthWorkspace)} />
        <Route path="/murabaha-calculator" component={renderInAdminShell(MurabahaCalculatorWorkspace)} />
        <Route path="/lc-amendments" component={renderInAdminShell(LCAmendmentsWorkspace)} />
        <Route path="/cheque-imaging" component={renderInAdminShell(ChequeImagingWorkspace)} />
        <Route path="/integration-tests" component={renderInAdminShell(IntegrationTestsWorkspace)} />
        <Route path="/seed-registry" component={renderInAdminShell(SeedRegistryWorkspace)} />
        <Route path="/infra-postgres" component={renderInAdminShell(InfraPostgresWorkspace)} />
        <Route path="/infra-kafka" component={renderInAdminShell(InfraKafkaWorkspace)} />
        <Route path="/infra-redis" component={renderInAdminShell(InfraRedisWorkspace)} />
        <Route path="/infra-temporal" component={renderInAdminShell(InfraTemporalWorkspace)} />
        <Route path="/infra-opensearch" component={renderInAdminShell(InfraOpenSearchWorkspace)} />
        <Route path="/infra-tigerbeetle" component={renderInAdminShell(InfraTigerBeetleWorkspace)} />
        <Route path="/infra-lakehouse" component={renderInAdminShell(InfraLakehouseWorkspace)} />
        {/* Gap Closure — Batch 1 (CRITICAL) */}
        <Route path="/eod-processor" component={renderInAdminShell(EODProcessorWorkspace)} />
        <Route path="/product-factory" component={renderInAdminShell(ProductFactoryWorkspace)} />
        <Route path="/accounting-rules" component={renderInAdminShell(AccountingRulesWorkspace)} />
        <Route path="/maker-checker" component={renderInAdminShell(MakerCheckerWorkspace)} />
        <Route path="/fx-revaluation" component={renderInAdminShell(FXRevaluationWorkspace)} />
        <Route path="/db-admin" component={renderInAdminShell(DBAdminWorkspace)} />
        {/* Gap Closure — Batch 2 (HIGH) */}
        <Route path="/cbn-returns" component={renderInAdminShell(CBNReturnsWorkspace)} />
        <Route path="/credit-facilities" component={renderInAdminShell(CreditFacilitiesWorkspace)} />
        <Route path="/statement-generator" component={renderInAdminShell(StatementGeneratorWorkspace)} />
        <Route path="/rate-cascade" component={renderInAdminShell(RateCascadeWorkspace)} />
        <Route path="/lcr-nsfr" component={renderInAdminShell(LCRNSFRWorkspace)} />
        {/* Gap Closure — Batch 3 (MEDIUM) */}
        <Route path="/relationship-pricing" component={renderInAdminShell(RelationshipPricingWorkspace)} />
        <Route path="/kafka-streaming" component={renderInAdminShell(KafkaStreamingWorkspace)} />
        <Route path="/temporal-sagas" component={renderInAdminShell(TemporalSagasWorkspace)} />
        <Route path="/mandate-management" component={renderInAdminShell(MandateManagementWorkspace)} />
        <Route path="/cif-management" component={renderInAdminShell(CIFManagementWorkspace)} />
        <Route path="/exam-management" component={renderInAdminShell(ExamManagementWorkspace)} />
        {/* KYC/KYB — World-Class Identity Verification */}
        <Route path="/kyc-engine" component={renderInAdminShell(KYCEngineWorkspace)} />
        <Route path="/kyb-engine" component={renderInAdminShell(KYBEngineWorkspace)} />
        <Route path="/liveness-detection" component={renderInAdminShell(LivenessDetectionWorkspace)} />
        <Route path="/face-match" component={renderInAdminShell(FaceMatchWorkspace)} />
        {/* KYC/KYB Integration — Admin Triggers, Events, Service Gates */}
        <Route path="/kyc-triggers" component={renderInAdminShell(KYCTriggersWorkspace)} />
        <Route path="/kyb-triggers" component={renderInAdminShell(KYBTriggersWorkspace)} />
        <Route path="/kyc-event-rules" component={renderInAdminShell(KYCEventRulesWorkspace)} />
        <Route path="/kyc-service-gates" component={renderInAdminShell(KYCServiceGatesWorkspace)} />
        <Route path="/kyc-overrides" component={renderInAdminShell(KYCOverridesWorkspace)} />
        {/* KYC/KYB Enhanced Suite — 22 enhancements (5 phases, 22 polyglot services) */}
        <Route path="/kyc-tiered-dashboard" component={renderInAdminShell(KYCTieredDashboardWorkspace)} />
        <Route path="/bvn-nin-verification" component={renderInAdminShell(BVNNINVerificationWorkspace)} />
        <Route path="/nfiu-ctr-str-filing" component={renderInAdminShell(NFIUCTRSTRFilingWorkspace)} />
        <Route path="/sanctions-screening" component={renderInAdminShell(SanctionsScreeningWorkspace)} />
        <Route path="/cac-verification" component={renderInAdminShell(CACVerificationWorkspace)} />
        <Route path="/txn-monitoring-rules" component={renderInAdminShell(TxnMonitoringRulesWorkspace)} />
        <Route path="/risk-based-approach" component={renderInAdminShell(RiskBasedApproachWorkspace)} />
        <Route path="/pep-enhanced-dd" component={renderInAdminShell(PEPEnhancedDDWorkspace)} />
        <Route path="/ubo-ownership-graph" component={renderInAdminShell(UBOOwnershipGraphWorkspace)} />
        <Route path="/multi-bureau-check" component={renderInAdminShell(MultiBureauCheckWorkspace)} />
        <Route path="/address-verification" component={renderInAdminShell(AddressVerificationWorkspace)} />
        <Route path="/corporate-doc-verify" component={renderInAdminShell(CorporateDocVerifyWorkspace)} />
        <Route path="/kyc-analytics-dash" component={renderInAdminShell(KYCAnalyticsDashWorkspace)} />
        <Route path="/video-kyc" component={renderInAdminShell(VideoKYCWorkspace)} />
        <Route path="/continuous-liveness" component={renderInAdminShell(ContinuousLivenessWorkspace)} />
        <Route path="/kyc-workflow" component={renderInAdminShell(KYCWorkflowWorkspace)} />
        <Route path="/kyc-self-service" component={renderInAdminShell(KYCSelfServiceWorkspace)} />
        <Route path="/agent-kyc-capture" component={renderInAdminShell(AgentKYCCaptureWorkspace)} />
        <Route path="/adverse-media" component={renderInAdminShell(AdverseMediaWorkspace)} />
        <Route path="/corporate-monitoring" component={renderInAdminShell(CorporateMonitoringWorkspace)} />
        <Route path="/kyc-data-quality" component={renderInAdminShell(KYCDataQualityWorkspace)} />
        <Route path="/efass-kyc-returns" component={renderInAdminShell(EFASSKYCReturnsWorkspace)} />
        <Route path="/kyc-enhanced-summary" component={renderInAdminShell(KYCEnhancedSummaryWorkspace)} />
        {/* AI/ML/DL/GNN/CV Suite */}
        <Route path="/gnn-fraud-detection" component={renderInAdminShell(GNNFraudDetectionWorkspace)} />
        <Route path="/fraudfusion-ensemble" component={renderInAdminShell(FraudFusionEnsembleWorkspace)} />
        <Route path="/mcmc-bayesian-risk" component={renderInAdminShell(MCMCBayesianRiskWorkspace)} />
        <Route path="/cocoindex-pipeline" component={renderInAdminShell(CocoIndexPipelineWorkspace)} />
        <Route path="/epr-kgqa" component={renderInAdminShell(EPRKGQAWorkspace)} />
        <Route path="/falkordb-graph" component={renderInAdminShell(FalkorDBGraphWorkspace)} />
        <Route path="/ollama-llm" component={renderInAdminShell(OllamaLLMWorkspace)} />
        <Route path="/art-adversarial" component={renderInAdminShell(ARTAdversarialWorkspace)} />
        <Route path="/mojaloop-pisp" component={renderInAdminShell(MojaloopPISPWorkspace)} />
        <Route path="/tb-multicurrency" component={renderInAdminShell(TBMultiCurrencyWorkspace)} />
        <Route path="/kafka-governance" component={renderInAdminShell(KafkaGovernanceWorkspace)} />
        {/* Production Hardening — Security */}
        <Route path="/cors-gateway" component={renderInAdminShell(CORSGatewayWorkspace)} />
        <Route path="/auth-enforcer" component={renderInAdminShell(AuthEnforcerWorkspace)} />
        <Route path="/request-validator" component={renderInAdminShell(RequestValidatorWorkspace)} />
        <Route path="/api-versioning" component={renderInAdminShell(APIVersioningWorkspace)} />
        <Route path="/apm-sentry" component={renderInAdminShell(APMSentryWorkspace)} />
        <Route path="/secrets-rotation" component={renderInAdminShell(SecretsRotationWorkspace)} />
        {/* Production Hardening — Data */}
        <Route path="/db-migration-manager" component={renderInAdminShell(DBMigrationManagerWorkspace)} />
        <Route path="/connection-pooler" component={renderInAdminShell(ConnectionPoolerWorkspace)} />
        <Route path="/backup-manager" component={renderInAdminShell(BackupManagerWorkspace)} />
        {/* Production Hardening — Testing */}
        <Route path="/unit-test-runner" component={renderInAdminShell(UnitTestRunnerWorkspace)} />
        <Route path="/e2e-orchestrator" component={renderInAdminShell(E2EOrchestratorWorkspace)} />
        <Route path="/contract-tests" component={renderInAdminShell(ContractTestWorkspace)} />
        <Route path="/load-test-runner" component={renderInAdminShell(LoadTestRunnerWorkspace)} />
        {/* Production Hardening — Observability */}
        <Route path="/otel-collector" component={renderInAdminShell(OTelCollectorWorkspace)} />
        <Route path="/changelog-generator" component={renderInAdminShell(ChangelogGeneratorWorkspace)} />
        <Route path="/helm-validator" component={renderInAdminShell(HelmValidatorWorkspace)} />
        {/* Production Hardening — Frontend */}
        <Route path="/accessibility-auditor" component={renderInAdminShell(AccessibilityAuditorWorkspace)} />
        <Route path="/i18n-service" component={renderInAdminShell(I18nServiceWorkspace)} />
        {/* Production Hardening — Missing Domains */}
        <Route path="/credit-scoring" component={renderInAdminShell(CreditScoringWorkspace)} />
        <Route path="/debt-collection" component={renderInAdminShell(DebtCollectionWorkspace)} />
        <Route path="/account-closure" component={renderInAdminShell(AccountClosureWorkspace)} />
        <Route path="/dormancy-management" component={renderInAdminShell(DormancyManagementWorkspace)} />
        <Route path="/interest-computation" component={renderInAdminShell(InterestComputationWorkspace)} />
        <Route path="/fee-management" component={renderInAdminShell(FeeManagementWorkspace)} />
        <Route path="/tax-reporting" component={renderInAdminShell(TaxReportingWorkspace)} />
        <Route path="/regulatory-sandbox" component={renderInAdminShell(RegulatorySandboxWorkspace)} />
        <Route path="/api-analytics" component={renderInAdminShell(APIAnalyticsWorkspace)} />
        <Route path="/developer-portal" component={renderInAdminShell(DeveloperPortalWorkspace)} />
        <Route path="/customer-360-dashboard" component={renderInAdminShell(Customer360DashboardWorkspace)} />
        <Route path="/realtime-pricing" component={renderInAdminShell(RealtimePricingWorkspace)} />
        {/* Multi-Tenant Platform */}
        <Route path="/tenant-isolation" component={renderInAdminShell(TenantIsolationWorkspace)} />
        <Route path="/feature-flag-engine" component={renderInAdminShell(FeatureFlagEngineWorkspace)} />
        <Route path="/white-label-engine" component={renderInAdminShell(WhiteLabelEngineWorkspace)} />
        <Route path="/white-label-config" component={renderInAdminShell(WhiteLabelConfigWorkspace)} />
        <Route path="/service-catalog" component={renderInAdminShell(ServiceCatalogWorkspace)} />
        <Route path="/tenant-provisioning" component={renderInAdminShell(TenantProvisioningWorkspace)} />
        <Route path="/branded-comms" component={renderInAdminShell(BrandedCommsWorkspace)} />
        <Route path="/event-streaming" component={renderInAdminShell(EventStreamingWorkspace)} />
        <Route path="/graduated-rollout" component={renderInAdminShell(GraduatedRolloutWorkspace)} />
        <Route path="/custom-domains" component={renderInAdminShell(CustomDomainWorkspace)} />
        <Route path="/tenant-metering" component={renderInAdminShell(TenantMeteringWorkspace)} />
        <Route path="/webhook-engine" component={renderInAdminShell(WebhookEngineWorkspace)} />
        <Route path="/approval-workflows" component={renderInAdminShell(ApprovalWorkflowWorkspace)} />
        <Route path="/plugin-marketplace" component={renderInAdminShell(PluginMarketplaceWorkspace)} />
        <Route path="/billing-orchestrator" component={renderInAdminShell(BillingOrchestratorWorkspace)} />
        <Route path="/billing-rbac" component={renderInAdminShell(BillingRbacWorkspace)} />
        <Route path="/billing-event-processor" component={renderInAdminShell(BillingEventProcessorWorkspace)} />
        <Route path="/security-hardening" component={renderInAdminShell(SecurityHardeningWorkspace)} />
        <Route path="/ddos-protection" component={renderInAdminShell(DDoSProtectionWorkspace)} />
        <Route path="/swift-messaging" component={renderInAdminShell(SwiftMessagingWorkspace)} />
        <Route path="/branch-operations-2" component={renderInAdminShell(BranchOperationsWorkspace2)} />
        <Route path="/microfinance-engine" component={renderInAdminShell(MicrofinanceEngineWorkspace)} />
        <Route path="/pbac-engine" component={renderInAdminShell(PBACEngineWorkspace)} />
        <Route path="/gl-engine" component={renderInAdminShell(GLEngineWorkspace)} />
        <Route path="/offline-resilience" component={renderInAdminShell(OfflineResilienceWorkspace)} />
        <Route path="/regulatory-automation" component={renderInAdminShell(RegulatoryAutomationWorkspace)} />
        <Route path="/database-persistence" component={renderInAdminShell(DatabasePersistenceWorkspace)} />
        <Route path="/kafka-event-bus" component={renderInAdminShell(KafkaEventBusWorkspace)} />
        <Route path="/jwt-auth" component={renderInAdminShell(JWTAuthWorkspace)} />
        <Route path="/e2e-tests" component={renderInAdminShell(E2ETestSuiteWorkspace)} />
        <Route path="/tigerbeetle-ledger" component={renderInAdminShell(TigerBeetleLedgerWorkspace)} />
        <Route path="/notifications-engine" component={renderInAdminShell(NotificationsWorkspace)} />
        <Route path="/report-generation" component={renderInAdminShell(ReportGenerationWorkspace)} />
        <Route path="/batch-eod" component={renderInAdminShell(BatchEodWorkspace)} />
        <Route path="/rate-limiting" component={renderInAdminShell(RateLimitingWorkspace)} />
        <Route path="/multi-currency-fx" component={renderInAdminShell(MultiCurrencyFxWorkspace)} />
        <Route path="/disaster-recovery" component={renderInAdminShell(DisasterRecoveryWorkspace)} />
        <Route path="/load-testing" component={renderInAdminShell(LoadTestingWorkspace)} />
        <Route path="/ai-fraud-detection" component={renderInAdminShell(AIFraudDetectionWorkspace)} />
        <Route path="/enaira-cbdc" component={renderInAdminShell(ENairaWorkspace)} />
        <Route path="/esg-banking" component={renderInAdminShell(ESGBankingWorkspace)} />
        <Route path="/embedded-finance" component={renderInAdminShell(EmbeddedFinanceWorkspace)} />
        <Route path="/ransomware-protection" component={renderInAdminShell(RansomwareProtectionWorkspace)} />
        <Route path="/ussd-banking" component={renderInAdminShell(USSDBankingWorkspace)} />
        <Route path="/sms-banking" component={renderInAdminShell(SMSBankingWorkspace)} />
        <Route path="/offline-transactions" component={renderInAdminShell(OfflineTransactionsWorkspace)} />
        <Route path="/bandwidth-adaptation" component={renderInAdminShell(BandwidthAdaptationWorkspace)} />
        <Route path="/resilience-dashboard" component={renderInAdminShell(ResilienceDashboardWorkspace)} />
        <Route path="/kpi-dashboard" component={renderInAdminShell(KPIDashboardWorkspace)} />
        <Route path="/branch-performance-map" component={renderInAdminShell(BranchPerformanceMapWorkspace)} />
        <Route path="/circuit-breaker-dashboard" component={renderInAdminShell(CircuitBreakerDashboardWorkspace)} />
        <Route path="/idempotency-dashboard" component={renderInAdminShell(IdempotencyDashboardWorkspace)} />
        <Route path="/error-catalog" component={renderInAdminShell(ErrorCatalogWorkspace)} />
        <Route path="/retry-policies" component={renderInAdminShell(RetryPoliciesWorkspace)} />
        <Route path="/error-telemetry" component={renderInAdminShell(ErrorTelemetryWorkspace)} />
        <Route path="/performance-cache" component={renderInAdminShell(PerformanceCacheWorkspace)} />
        <Route path="/performance-metrics" component={renderInAdminShell(PerformanceMetricsWorkspace)} />
        <Route path="/keda-autoscaling" component={renderInAdminShell(KedaAutoscalingWorkspace)} />
        <Route path="/keda-policies" component={renderInAdminShell(KedaPoliciesWorkspace)} />
        <Route path="/ha-services" component={renderInAdminShell(HAServicesWorkspace)} />
        <Route path="/ha-middleware" component={renderInAdminShell(HAMiddlewareWorkspace)} />
        <Route path="/ha-zones" component={renderInAdminShell(HAZonesWorkspace)} />
        <Route path="/lakehouse-domain-cdc" component={renderInAdminShell(LakehouseDomainCDCWorkspace)} />
        <Route path="/lakehouse-cdc-events" component={renderInAdminShell(LakehouseCDCEventsWorkspace)} />
        <Route path="/lakehouse-clients" component={renderInAdminShell(LakehouseClientsWorkspace)} />
        <Route path="/lakehouse-query-federation" component={renderInAdminShell(LakehouseQueryFederationWorkspace)} />
        <Route path="/lakehouse-materialized-views" component={renderInAdminShell(LakehouseMaterializedViewsWorkspace)} />
        <Route path="/lakehouse-lineage-nodes" component={renderInAdminShell(LakehouseLineageNodesWorkspace)} />
        <Route path="/lakehouse-lineage-edges" component={renderInAdminShell(LakehouseLineageEdgesWorkspace)} />
        <Route path="/pg-query-profiles" component={renderInAdminShell(PgQueryProfilesWorkspace)} />
        <Route path="/pg-index-advisory" component={renderInAdminShell(PgIndexAdvisoryWorkspace)} />
        <Route path="/pg-connection-pools" component={renderInAdminShell(PgConnectionPoolsWorkspace)} />
        <Route path="/pg-slow-queries" component={renderInAdminShell(PgSlowQueriesWorkspace)} />
        <Route path="/pg-table-stats" component={renderInAdminShell(PgTableStatsWorkspace)} />
        <Route path="/pg-tuning-params" component={renderInAdminShell(PgTuningParamsWorkspace)} />
        <Route path="/apisix-routes" component={renderInAdminShell(ApisixRoutesWorkspace)} />
        <Route path="/apisix-upstreams" component={renderInAdminShell(ApisixUpstreamsWorkspace)} />
        <Route path="/apisix-plugins" component={renderInAdminShell(ApisixPluginsWorkspace)} />
        <Route path="/openappsec-rules" component={renderInAdminShell(OpenappsecRulesWorkspace)} />
        <Route path="/openappsec-events" component={renderInAdminShell(OpenappsecEventsWorkspace)} />
        <Route path="/keycloak-realms" component={renderInAdminShell(KeycloakRealmsWorkspace)} />
        <Route path="/keycloak-clients" component={renderInAdminShell(KeycloakClientsWorkspace)} />
        <Route path="/keycloak-roles" component={renderInAdminShell(KeycloakRolesWorkspace)} />
        <Route path="/keycloak-identity-providers" component={renderInAdminShell(KeycloakIdPsWorkspace)} />
        <Route path="/service-registry" component={renderInAdminShell(ServiceRegistryWorkspace)} />
        <Route path="/proxy-routes" component={renderInAdminShell(ProxyRoutesWorkspace)} />
        <Route path="/otel-configs" component={renderInAdminShell(OtelConfigsWorkspace)} />
        <Route path="/prometheus-metrics" component={renderInAdminShell(PrometheusMetricsWorkspace)} />
        <Route path="/grafana-dashboards" component={renderInAdminShell(GrafanaDashboardsWorkspace)} />
        <Route path="/alert-rules" component={renderInAdminShell(AlertRulesWorkspace)} />
        <Route path="/mojaloop-callbacks" component={renderInAdminShell(MojaloopCallbacksWorkspace)} />
        <Route path="/mojaloop-callback-endpoints" component={renderInAdminShell(MojaloopCallbackEndpointsWorkspace)} />
        <Route path="/mojaloop-ilp-packets" component={renderInAdminShell(MojaloopILPPacketsWorkspace)} />
        <Route path="/mojaloop-settlement-windows" component={renderInAdminShell(MojaloopSettlementWindowsWorkspace)} />
        <Route path="/mojaloop-settlement-models" component={renderInAdminShell(MojaloopSettlementModelsWorkspace)} />
        <Route path="/mojaloop-admin-participants" component={renderInAdminShell(MojaloopAdminParticipantsWorkspace)} />
        <Route path="/mojaloop-admin-limits" component={renderInAdminShell(MojaloopAdminLimitsWorkspace)} />
        <Route path="/mojaloop-corridors" component={renderInAdminShell(MojaloopCorridorsWorkspace)} />
        <Route path="/mojaloop-tb-bridge-entries" component={renderInAdminShell(MojaloopTBBridgeEntriesWorkspace)} />
        <Route path="/mojaloop-tb-bridge-configs" component={renderInAdminShell(MojaloopTBBridgeConfigsWorkspace)} />
        <Route path="/tb-pg-sync-configs" component={renderInAdminShell(TBPGSyncConfigsWorkspace)} />
        <Route path="/tb-pg-sync-events" component={renderInAdminShell(TBPGSyncEventsWorkspace)} />
        <Route path="/tb-pg-reconciliation-runs" component={renderInAdminShell(TBPGReconciliationRunsWorkspace)} />
        <Route path="/tb-pg-reconciliation-rules" component={renderInAdminShell(TBPGReconciliationRulesWorkspace)} />
        <Route path="/tb-pg-balance-cache-configs" component={renderInAdminShell(TBPGBalanceCacheConfigsWorkspace)} />
        <Route path="/tb-pg-balance-cache-entries" component={renderInAdminShell(TBPGBalanceCacheEntriesWorkspace)} />
        <Route path="/tb-pg-saga-definitions" component={renderInAdminShell(TBPGSagaDefinitionsWorkspace)} />
        <Route path="/tb-pg-saga-executions" component={renderInAdminShell(TBPGSagaExecutionsWorkspace)} />
        {/* Security Enhancement */}
        <Route path="/scratch-card-pins" component={renderInAdminShell(ScratchCardPINWorkspace)} />
        <Route path="/hsm-key-manager" component={renderInAdminShell(HSMKeyManagerWorkspace)} />
        <Route path="/pin-block-engine" component={renderInAdminShell(PINBlockEngineWorkspace)} />
        <Route path="/grid-token-cards" component={renderInAdminShell(GridTokenCardWorkspace)} />
        <Route path="/mfa-orchestrator" component={renderInAdminShell(MFAOrchestratorWorkspace)} />
        <Route path="/otp-hardening" component={renderInAdminShell(OTPHardeningWorkspace)} />
        <Route path="/session-security" component={renderInAdminShell(SessionSecurityWorkspace)} />
        <Route path="/api-key-vault" component={renderInAdminShell(APIKeyVaultWorkspace)} />
        <Route path="/adaptive-rate-limiter" component={renderInAdminShell(AdaptiveRateLimiterWorkspace)} />
        <Route path="/field-level-encryption" component={renderInAdminShell(FieldLevelEncryptionWorkspace)} />
        <Route path="/certificate-manager" component={renderInAdminShell(CertificateManagerWorkspace)} />
        <Route path="/security-audit-logger" component={renderInAdminShell(SecurityAuditLoggerWorkspace)} />
        <Route path="/jwt-validator" component={renderInAdminShell(JWTValidatorWorkspace)} />
        <Route path="/route-schema-enforcer" component={renderInAdminShell(RouteSchemaEnforcerWorkspace)} />
        <Route path="/sql-parameterizer" component={renderInAdminShell(SQLParameterizerWorkspace)} />
        <Route path="/secrets-vault" component={renderInAdminShell(SecretsVaultWorkspace)} />
        <Route path="/pin-hasher" component={renderInAdminShell(PINHasherWorkspace)} />
        <Route path="/docker-hardener" component={renderInAdminShell(DockerHardenerWorkspace)} />
        <Route path="/pkce-auth-flow" component={renderInAdminShell(PKCEAuthFlowWorkspace)} />
        <Route path="/token-rotation" component={renderInAdminShell(TokenRotationWorkspace)} />
        <Route path="/mtls-mesh" component={renderInAdminShell(MTLSMeshWorkspace)} />
        <Route path="/body-limit-enforcer" component={renderInAdminShell(BodyLimitEnforcerWorkspace)} />
        <Route path="/cloud-kms-bridge" component={renderInAdminShell(CloudKMSBridgeWorkspace)} />
        <Route path="/tls-terminator" component={renderInAdminShell(TLSTerminatorWorkspace)} />
        <Route path="/event-correlator" component={renderInAdminShell(EventCorrelatorWorkspace)} />
        <Route path="/pci-scanner" component={renderInAdminShell(PCIScannerWorkspace)} />
        <Route path="/api-key-enforcer" component={renderInAdminShell(APIKeyEnforcerWorkspace)} />
        <Route path="/path-validator" component={renderInAdminShell(PathValidatorWorkspace)} />
        <Route path="/key-rotation-engine" component={renderInAdminShell(KeyRotationEngineWorkspace)} />
        <Route path="/network-policy-manager" component={renderInAdminShell(NetworkPolicyManagerWorkspace)} />
        <Route path="/vault-integration" component={renderInAdminShell(VaultIntegrationWorkspace)} />
        <Route path="/anomaly-detector" component={renderInAdminShell(AnomalyDetectorWorkspace)} />
        <Route path="/ndpr-compliance" component={renderInAdminShell(NDPRComplianceWorkspace)} />
        <Route path="/output-encoder" component={renderInAdminShell(OutputEncoderWorkspace)} />
        <Route path="/image-scanner" component={renderInAdminShell(ImageScannerWorkspace)} />
        <Route path="/waf-rules-engine" component={renderInAdminShell(WAFRulesEngineWorkspace)} />
        <Route path="/ddos-shield" component={renderInAdminShell(DDoSShieldWorkspace)} />
        <Route path="/ip-allowlist" component={renderInAdminShell(IPAllowlistWorkspace)} />
        <Route path="/siem-exporter" component={renderInAdminShell(SIEMExporterWorkspace)} />
        <Route path="/cbn-compliance-checker" component={renderInAdminShell(CBNComplianceCheckerWorkspace)} />
        <Route path="/egress-controller" component={renderInAdminShell(EgressControllerWorkspace)} />
        <Route path="/incident-responder" component={renderInAdminShell(IncidentResponderWorkspace)} />
        <Route path="/immutable-audit" component={renderInAdminShell(ImmutableAuditWorkspace)} />
        <Route path="/soc2-evidence" component={renderInAdminShell(SOC2EvidenceWorkspace)} />
        <Route path="/pentest-orchestrator" component={renderInAdminShell(PentestOrchestratorWorkspace)} />
        <Route path="/sri-validator" component={renderInAdminShell(SRIValidatorWorkspace)} />
        <Route path="/csp-nonce-engine" component={renderInAdminShell(CSPNonceEngineWorkspace)} />
        <Route path="/clickjack-defender" component={renderInAdminShell(ClickjackDefenderWorkspace)} />
        <Route path="/browser-fingerprint" component={renderInAdminShell(BrowserFingerprintWorkspace)} />
        <Route path="/redis-cache-middleware" component={renderInAdminShell(RedisCacheMiddlewareWorkspace)} />
        <Route path="/redis-session-store" component={renderInAdminShell(RedisSessionStoreWorkspace)} />
        <Route path="/cache-invalidation" component={renderInAdminShell(CacheInvalidationWorkspace)} />
        <Route path="/bloom-filter-cache" component={renderInAdminShell(BloomFilterCacheWorkspace)} />
        <Route path="/sorted-set-ranking" component={renderInAdminShell(SortedSetRankingWorkspace)} />
        <Route path="/pgbouncer-manager" component={renderInAdminShell(PgBouncerManagerWorkspace)} />
        <Route path="/query-cache-engine" component={renderInAdminShell(QueryCacheEngineWorkspace)} />
        <Route path="/prepared-stmt-cache" component={renderInAdminShell(PreparedStmtCacheWorkspace)} />
        <Route path="/table-partitioner" component={renderInAdminShell(TablePartitionerWorkspace)} />
        <Route path="/materialized-view-engine" component={renderInAdminShell(MaterializedViewEngineWorkspace)} />
        <Route path="/hot-data-cache" component={renderInAdminShell(HotDataCacheWorkspace)} />
        <Route path="/batch-aggregator" component={renderInAdminShell(BatchAggregatorWorkspace)} />
        <Route path="/keepalive-tuner" component={renderInAdminShell(KeepaliveTunerWorkspace)} />
        <Route path="/response-compressor" component={renderInAdminShell(ResponseCompressorWorkspace)} />
        <Route path="/grpc-hot-path" component={renderInAdminShell(GRPCHotPathWorkspace)} />
        <Route path="/route-trie-optimizer" component={renderInAdminShell(RouteTrieOptimizerWorkspace)} />
        <Route path="/stream-response" component={renderInAdminShell(StreamResponseWorkspace)} />
        <Route path="/http2-multiplexer" component={renderInAdminShell(HTTP2MultiplexerWorkspace)} />
        <Route path="/request-coalescer" component={renderInAdminShell(RequestCoalescerWorkspace)} />
        <Route path="/fast-json-serializer" component={renderInAdminShell(FastJSONSerializerWorkspace)} />
        <Route path="/sw-api-cache" component={renderInAdminShell(SWAPICacheWorkspace)} />
        <Route path="/virtual-scroll-engine" component={renderInAdminShell(VirtualScrollEngineWorkspace)} />
        <Route path="/component-memoizer" component={renderInAdminShell(ComponentMemoizerWorkspace)} />
        <Route path="/bundle-splitter" component={renderInAdminShell(BundleSplitterWorkspace)} />
        <Route path="/optimistic-ui-engine" component={renderInAdminShell(OptimisticUIEngineWorkspace)} />
        <Route path="/kafka-consumer-optimizer" component={renderInAdminShell(KafkaConsumerOptimizerWorkspace)} />
        <Route path="/kafka-batch-producer" component={renderInAdminShell(KafkaBatchProducerWorkspace)} />
        <Route path="/avro-schema-registry" component={renderInAdminShell(AvroSchemaRegistryWorkspace)} />
        <Route path="/fluvio-wasm-transform" component={renderInAdminShell(FluvioWASMTransformWorkspace)} />
        <Route path="/event-dedup-engine" component={renderInAdminShell(EventDedupEngineWorkspace)} />
        <Route path="/distroless-builder" component={renderInAdminShell(DistrolessBuilderWorkspace)} />
        <Route path="/tigerbeetle-batch" component={renderInAdminShell(TigerBeetleBatchWorkspace)} />
        <Route path="/hpa-autoscaler" component={renderInAdminShell(HPAAutoscalerWorkspace)} />
        <Route path="/cdn-edge-cache" component={renderInAdminShell(CDNEdgeCacheWorkspace)} />
        <Route path="/read-replica-router" component={renderInAdminShell(ReadReplicaRouterWorkspace)} />
        <Route path="/keda-scaler" component={renderInAdminShell(KEDAScalerWorkspace)} />
        <Route path="/prometheus-dashboard" component={renderInAdminShell(PrometheusDashboardWorkspace)} />
        <Route path="/opensearch-optimizer" component={renderInAdminShell(OpenSearchOptimizerWorkspace)} />
        <Route path="/temporal-memoizer" component={renderInAdminShell(TemporalMemoizerWorkspace)} />
        <Route path="/apisix-plugin-optimizer" component={renderInAdminShell(APISIXPluginOptimizerWorkspace)} />
        <Route path="/aml-risk-scoring" component={renderInAdminShell(AMLRiskScoringWorkspace)} />
        <Route path="/sar-filing" component={renderInAdminShell(SARFilingEngineWorkspace)} />
        <Route path="/ctr-auto-filer" component={renderInAdminShell(CTRAutoFilerWorkspace)} />
        <Route path="/aml-case-manager" component={renderInAdminShell(AMLCaseManagerWorkspace)} />
        <Route path="/watchlist-manager" component={renderInAdminShell(WatchlistManagerWorkspace)} />
        <Route path="/adverse-media-scanner" component={renderInAdminShell(AdverseMediaScannerWorkspace)} />
        <Route path="/beneficial-ownership" component={renderInAdminShell(BeneficialOwnershipWorkspace)} />
        <Route path="/txn-pattern-analyzer" component={renderInAdminShell(TxnPatternAnalyzerWorkspace)} />
        <Route path="/goaml-integration" component={renderInAdminShell(GoAMLIntegrationWorkspace)} />
        <Route path="/aml-compliance-dashboard" component={renderInAdminShell(AMLComplianceDashboardWorkspace)} />
        <Route path="/sanctions-batch-rescreener" component={renderInAdminShell(SanctionsBatchRescreenerWorkspace)} />
        <Route path="/aml-training-tracker" component={renderInAdminShell(AMLTrainingTrackerWorkspace)} />
        <Route path="/wire-transfer-monitor" component={renderInAdminShell(WireTransferMonitorWorkspace)} />
        <Route path="/aml-regulatory-reporting" component={renderInAdminShell(AMLRegulatoryReportingWorkspace)} />
        <Route path="/typology-detector" component={renderInAdminShell(TypologyDetectorWorkspace)} />

        {/* Agriculture Enhancement (40 services) */}
        <Route path="/agriculture-enhancement/cooperative-management" component={renderInAdminShell(CooperativeManagementWorkspace)} />
        <Route path="/agriculture-enhancement/livestock-management" component={renderInAdminShell(LivestockManagementWorkspace)} />
        <Route path="/agriculture-enhancement/agri-input-marketplace" component={renderInAdminShell(AgriInputMarketplaceWorkspace)} />
        <Route path="/agriculture-enhancement/nirsal-credit-guarantee" component={renderInAdminShell(NirsalCreditGuaranteeWorkspace)} />
        <Route path="/agriculture-enhancement/cbn-anchor-borrowers" component={renderInAdminShell(CbnAnchorBorrowersWorkspace)} />
        <Route path="/agriculture-enhancement/interactive-ussd-agri" component={renderInAdminShell(InteractiveUssdAgriWorkspace)} />
        <Route path="/agriculture-enhancement/agri-savings-cycles" component={renderInAdminShell(AgriSavingsCyclesWorkspace)} />
        <Route path="/agriculture-enhancement/livestock-finance" component={renderInAdminShell(LivestockFinanceWorkspace)} />
        <Route path="/agriculture-enhancement/commodity-exchange" component={renderInAdminShell(CommodityExchangeWorkspace)} />
        <Route path="/agriculture-enhancement/agri-evoucher" component={renderInAdminShell(AgriEvoucherWorkspace)} />
        <Route path="/agriculture-enhancement/commodity-price-intelligence" component={renderInAdminShell(CommodityPriceIntelligenceWorkspace)} />
        <Route path="/agriculture-enhancement/satellite-crop-monitor" component={renderInAdminShell(SatelliteCropMonitorWorkspace)} />
        <Route path="/agriculture-enhancement/cooperative-credit-scoring" component={renderInAdminShell(CooperativeCreditScoringWorkspace)} />
        <Route path="/agriculture-enhancement/fisheries-aquaculture" component={renderInAdminShell(FisheriesAquacultureWorkspace)} />
        <Route path="/agriculture-enhancement/farm-boundary-mapping" component={renderInAdminShell(FarmBoundaryMappingWorkspace)} />
        <Route path="/agriculture-enhancement/area-yield-index-insurance" component={renderInAdminShell(AreaYieldIndexInsuranceWorkspace)} />
        <Route path="/agriculture-enhancement/warehouse-management" component={renderInAdminShell(WarehouseManagementWorkspace)} />
        <Route path="/agriculture-enhancement/agent-farmer-onboarding" component={renderInAdminShell(AgentFarmerOnboardingWorkspace)} />
        <Route path="/agriculture-enhancement/livestock-insurance" component={renderInAdminShell(LivestockInsuranceWorkspace)} />
        <Route path="/agriculture-enhancement/equipment-leasing" component={renderInAdminShell(EquipmentLeasingWorkspace)} />
        <Route path="/agriculture-enhancement/crop-yield-prediction" component={renderInAdminShell(CropYieldPredictionWorkspace)} />
        <Route path="/agriculture-enhancement/multi-peril-crop-insurance" component={renderInAdminShell(MultiPerilCropInsuranceWorkspace)} />
        <Route path="/agriculture-enhancement/agri-logistics" component={renderInAdminShell(AgriLogisticsWorkspace)} />
        <Route path="/agriculture-enhancement/cbn-agri-returns" component={renderInAdminShell(CbnAgriReturnsWorkspace)} />
        <Route path="/agriculture-enhancement/animal-id-traceability" component={renderInAdminShell(AnimalIdTraceabilityWorkspace)} />
        <Route path="/agriculture-enhancement/nirsal-agro-geocoop" component={renderInAdminShell(NirsalAgroGeocoopWorkspace)} />
        <Route path="/agriculture-enhancement/agri-iot-sensor" component={renderInAdminShell(AgriIotSensorWorkspace)} />
        <Route path="/agriculture-enhancement/agri-reinsurance" component={renderInAdminShell(AgriReinsuranceWorkspace)} />
        <Route path="/agriculture-enhancement/quality-certification" component={renderInAdminShell(QualityCertificationWorkspace)} />
        <Route path="/agriculture-enhancement/agri-esg-impact" component={renderInAdminShell(AgriEsgImpactWorkspace)} />
        <Route path="/agriculture-enhancement/crossborder-agri-trade" component={renderInAdminShell(CrossborderAgriTradeWorkspace)} />
        <Route path="/agriculture-enhancement/cooperative-meetings" component={renderInAdminShell(CooperativeMeetingsWorkspace)} />
        <Route path="/agriculture-enhancement/cooperative-financials" component={renderInAdminShell(CooperativeFinancialsWorkspace)} />
        <Route path="/agriculture-enhancement/soil-analysis" component={renderInAdminShell(SoilAnalysisWorkspace)} />
        <Route path="/agriculture-enhancement/insurance-portfolio-analytics" component={renderInAdminShell(InsurancePortfolioAnalyticsWorkspace)} />
        <Route path="/agriculture-enhancement/parametric-insurance-iot" component={renderInAdminShell(ParametricInsuranceIotWorkspace)} />
        <Route path="/agriculture-enhancement/post-harvest-loss-tracker" component={renderInAdminShell(PostHarvestLossTrackerWorkspace)} />
        <Route path="/agriculture-enhancement/aggregation-center" component={renderInAdminShell(AggregationCenterWorkspace)} />
        <Route path="/agriculture-enhancement/cbn-agsmeis" component={renderInAdminShell(CbnAgsmeisWorkspace)} />
        <Route path="/agriculture-enhancement/acgsf-guarantee" component={renderInAdminShell(AcgsfGuaranteeWorkspace)} />

        {/* Channel Banking (25 services) */}
        <Route path="/channel-banking/voice-banking-gateway" component={renderInAdminShell(VoiceBankingGatewayWorkspace)} />
        <Route path="/channel-banking/voice-tts-nigerian" component={renderInAdminShell(VoiceTtsNigerianWorkspace)} />
        <Route path="/channel-banking/voice-asr-nigerian" component={renderInAdminShell(VoiceAsrNigerianWorkspace)} />
        <Route path="/channel-banking/voice-nlu-banking" component={renderInAdminShell(VoiceNluBankingWorkspace)} />
        <Route path="/channel-banking/voice-biometric-auth" component={renderInAdminShell(VoiceBiometricAuthWorkspace)} />
        <Route path="/channel-banking/voice-ivr-menu" component={renderInAdminShell(VoiceIvrMenuWorkspace)} />
        <Route path="/channel-banking/voice-call-analytics" component={renderInAdminShell(VoiceCallAnalyticsWorkspace)} />
        <Route path="/channel-banking/voice-agent-escalation" component={renderInAdminShell(VoiceAgentEscalationWorkspace)} />
        <Route path="/channel-banking/telegram-bot-gateway" component={renderInAdminShell(TelegramBotGatewayWorkspace)} />
        <Route path="/channel-banking/telegram-banking-commands" component={renderInAdminShell(TelegramBankingCommandsWorkspace)} />
        <Route path="/channel-banking/telegram-notification" component={renderInAdminShell(TelegramNotificationWorkspace)} />
        <Route path="/channel-banking/telegram-mini-app" component={renderInAdminShell(TelegramMiniAppWorkspace)} />
        <Route path="/channel-banking/telegram-kyc-bot" component={renderInAdminShell(TelegramKycBotWorkspace)} />
        <Route path="/channel-banking/whatsapp-business-gateway" component={renderInAdminShell(WhatsappBusinessGatewayWorkspace)} />
        <Route path="/channel-banking/whatsapp-banking-flows" component={renderInAdminShell(WhatsappBankingFlowsWorkspace)} />
        <Route path="/channel-banking/whatsapp-payment-integration" component={renderInAdminShell(WhatsappPaymentIntegrationWorkspace)} />
        <Route path="/channel-banking/whatsapp-notification" component={renderInAdminShell(WhatsappNotificationWorkspace)} />
        <Route path="/channel-banking/whatsapp-document-service" component={renderInAdminShell(WhatsappDocumentServiceWorkspace)} />
        <Route path="/channel-banking/ussd-banking-gateway" component={renderInAdminShell(UssdBankingGatewayWorkspace)} />
        <Route path="/channel-banking/ussd-transaction-engine" component={renderInAdminShell(UssdTransactionEngineWorkspace)} />
        <Route path="/channel-banking/ussd-multilingual" component={renderInAdminShell(UssdMultilingualWorkspace)} />
        <Route path="/channel-banking/ussd-sim-toolkit" component={renderInAdminShell(UssdSimToolkitWorkspace)} />
        <Route path="/channel-banking/sms-banking-gateway" component={renderInAdminShell(SmsBankingGatewayWorkspace)} />
        <Route path="/channel-banking/sms-otp-service" component={renderInAdminShell(SmsOtpServiceWorkspace)} />
        <Route path="/channel-banking/sms-alert-notification" component={renderInAdminShell(SmsAlertNotificationWorkspace)} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
