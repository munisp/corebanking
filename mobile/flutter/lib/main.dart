import 'package:flutter/material.dart';
import 'screens/account_opening_screen.dart';
import 'screens/account_statements_screen.dart';
import 'screens/accounting_rules_screen.dart';
import 'screens/admin_dashboard_screen.dart';
import 'screens/agent_banking_screen.dart';
import 'screens/agent_performance_screen.dart';
import 'screens/agricultural_insurance_screen.dart';
import 'screens/ai_agent_hub_screen.dart';
import 'screens/ai_fraud_detection_screen.dart';
import 'screens/stakeholder_kpi_dashboard_screen.dart';
import 'screens/alert_rules_screen.dart';
import 'screens/analytics_widgets_screen.dart';
import 'screens/api_marketplace_screen.dart';
import 'screens/apisix_plugins_screen.dart';
import 'screens/apisix_routes_screen.dart';
import 'screens/apisix_upstreams_screen.dart';
import 'screens/approval_workflow_screen.dart';
import 'screens/atm_management_screen.dart';
import 'screens/audit_trail_screen.dart';
import 'screens/bandwidth_adaptation_screen.dart';
import 'screens/bank_guarantees_screen.dart';
import 'screens/basel_engine_screen.dart';
import 'screens/batch_eod_screen.dart';
import 'screens/batch_processing_screen.dart';
import 'screens/beneficiary_mgmt_screen.dart';
import 'screens/billing_engine_screen.dart';
import 'screens/billing_event_processor_screen.dart';
import 'screens/billing_orchestrator_screen.dart';
import 'screens/billing_rbac_screen.dart';
import 'screens/biometric_auth_screen.dart';
import 'screens/branch_operations_screen.dart';
import 'screens/branded_comms_screen.dart';
import 'screens/bulk_payments_screen.dart';
import 'screens/card_fraud_rules_screen.dart';
import 'screens/card_management_screen.dart';
import 'screens/card_tokens_screen.dart';
import 'screens/cards_screen.dart';
import 'screens/cash_management_screen.dart';
import 'screens/cash_pooling_screen.dart';
import 'screens/cbn_returns_screen.dart';
import 'screens/channel_management_screen.dart';
import 'screens/chart_of_accounts_screen.dart';
import 'screens/chatbot_screen.dart';
import 'screens/cheque_clearing_screen.dart';
import 'screens/cheque_imaging_screen.dart';
import 'screens/cif_management_screen.dart';
import 'screens/circuit_breaker_dashboard_screen.dart';
import 'screens/collateral_screen.dart';
import 'screens/collateral_valuation_screen.dart';
import 'screens/complaints_screen.dart';
import 'screens/compliance_checks_screen.dart';
import 'screens/component_showcase_screen.dart';
import 'screens/contingent_liabilities_screen.dart';
import 'screens/correspondent_banking_screen.dart';
import 'screens/credit_bureau_screen.dart';
import 'screens/credit_facilities_screen.dart';
import 'screens/credit_risk_screen.dart';
import 'screens/custody_service_screen.dart';
import 'screens/custom_domain_screen.dart';
import 'screens/customer_360_screen.dart';
import 'screens/customer_bills_screen.dart';
import 'screens/customer_cards_screen.dart';
import 'screens/customer_dashboard_screen.dart';
import 'screens/customer_engagement_screen.dart';
import 'screens/customer_feedback_screen.dart';
import 'screens/customer_insights_screen.dart';
import 'screens/customer_loans_screen.dart';
import 'screens/customer_notifications_screen.dart';
import 'screens/customer_onboarding_screen.dart';
import 'screens/customer_qr_screen.dart';
import 'screens/customer_savings_screen.dart';
import 'screens/customer_segments_screen.dart';
import 'screens/customer_settings_screen.dart';
import 'screens/customer_statements_screen.dart';
import 'screens/customer_transfers_screen.dart';
import 'screens/customers_screen.dart';
import 'screens/dapr_sidecar_screen.dart';
import 'screens/data_export_screen.dart';
import 'screens/database_persistence_screen.dart';
import 'screens/db_admin_screen.dart';
import 'screens/ddos_protection_screen.dart';
import 'screens/diaspora_banking_screen.dart';
import 'screens/disaster_recovery_screen.dart';
import 'screens/dispute_management_screen.dart';
import 'screens/doc_collections_screen.dart';
import 'screens/document_management_screen.dart';
import 'screens/dormancy_mgmt_screen.dart';
import 'screens/e2e_tests_screen.dart';
import 'screens/education_loans_screen.dart';
import 'screens/embedded_finance_screen.dart';
import 'screens/enaira_cbdc_screen.dart';
import 'screens/eod_processor_screen.dart';
import 'screens/erp_next_screen.dart';
import 'screens/error_catalog_screen.dart';
import 'screens/error_telemetry_screen.dart';
import 'screens/escrow_screen.dart';
import 'screens/esg_banking_screen.dart';
import 'screens/esusu_screen.dart';
import 'screens/etd_trading_screen.dart';
import 'screens/etl_pipelines_screen.dart';
import 'screens/event_bus_screen.dart';
import 'screens/event_streaming_screen.dart';
import 'screens/exam_management_screen.dart';
import 'screens/expense_mgmt_screen.dart';
import 'screens/face_match_screen.dart';
import 'screens/factoring_screen.dart';
import 'screens/fatca_crs_screen.dart';
import 'screens/feature_flag_engine_screen.dart';
import 'screens/fee_schedules_screen.dart';
import 'screens/fixed_assets_screen.dart';
import 'screens/fixed_deposits_screen.dart';
import 'screens/fluvio_streams_screen.dart';
import 'screens/fraud_alerts_screen.dart';
import 'screens/fraud_detection_screen.dart';
import 'screens/fraud_rules_screen.dart';
import 'screens/fx_dealing_room_screen.dart';
import 'screens/fx_positions_screen.dart';
import 'screens/fx_rates_screen.dart';
import 'screens/fx_revaluation_screen.dart';
import 'screens/gl_accounts_screen.dart';
import 'screens/gl_engine_screen.dart';
import 'screens/graduated_rollout_screen.dart';
import 'screens/grafana_dashboards_screen.dart';
import 'screens/ha_middleware_screen.dart';
import 'screens/ha_services_screen.dart';
import 'screens/ha_zones_screen.dart';
import 'screens/home_screen.dart';
import 'screens/idempotency_dashboard_screen.dart';
import 'screens/identity_channels_screen.dart';
import 'screens/ifrs9_engine_screen.dart';
import 'screens/infra_kafka_screen.dart';
import 'screens/infra_lakehouse_screen.dart';
import 'screens/infra_opensearch_screen.dart';
import 'screens/infra_postgres_screen.dart';
import 'screens/infra_redis_screen.dart';
import 'screens/infra_temporal_screen.dart';
import 'screens/infra_tigerbeetle_screen.dart';
import 'screens/insurance_screen.dart';
import 'screens/integration_tests_screen.dart';
import 'screens/interbank_lending_screen.dart';
import 'screens/interbank_settlement_screen.dart';
import 'screens/interest_accrual_screen.dart';
import 'screens/interest_rate_screen.dart';
import 'screens/inventory_finance_screen.dart';
import 'screens/inventory_screen.dart';
import 'screens/islamic_banking_screen.dart';
import 'screens/iso20022_hub_screen.dart';
import 'screens/journal_entries_screen.dart';
import 'screens/jwt_auth_screen.dart';
import 'screens/kafka_event_bus_screen.dart';
import 'screens/kafka_streaming_screen.dart';
import 'screens/keda_autoscaling_screen.dart';
import 'screens/keda_policies_screen.dart';
import 'screens/keycloak_clients_screen.dart';
import 'screens/keycloak_idps_screen.dart';
import 'screens/keycloak_realms_screen.dart';
import 'screens/keycloak_roles_screen.dart';
import 'screens/keycloak_screen.dart';
import 'screens/kyb_engine_screen.dart';
import 'screens/kyb_triggers_screen.dart';
import 'screens/kyc_aml_screen.dart';
import 'screens/kyc_engine_screen.dart';
import 'screens/kyc_event_rules_screen.dart';
import 'screens/kyc_overrides_screen.dart';
import 'screens/kyc_service_gates_screen.dart';
import 'screens/kyc_triggers_screen.dart';
import 'screens/kyc_tiered_dashboard_screen.dart';
import 'screens/bvn_nin_verification_screen.dart';
import 'screens/nfiu_ctr_str_filing_screen.dart';
import 'screens/sanctions_screening_screen.dart';
import 'screens/cac_verification_screen.dart';
import 'screens/txn_monitoring_rules_screen.dart';
import 'screens/risk_based_approach_screen.dart';
import 'screens/pep_enhanced_dd_screen.dart';
import 'screens/ubo_ownership_graph_screen.dart';
import 'screens/multi_bureau_check_screen.dart';
import 'screens/address_verification_screen.dart';
import 'screens/corporate_doc_verify_screen.dart';
import 'screens/kyc_analytics_dash_screen.dart';
import 'screens/video_kyc_screen.dart';
import 'screens/continuous_liveness_screen.dart';
import 'screens/kyc_workflow_screen.dart';
import 'screens/kyc_self_service_screen.dart';
import 'screens/agent_kyc_capture_screen.dart';
import 'screens/adverse_media_screen.dart';
import 'screens/corporate_monitoring_screen.dart';
import 'screens/kyc_data_quality_screen.dart';
import 'screens/efass_kyc_returns_screen.dart';
import 'screens/kyc_enhanced_summary_screen.dart';
import 'screens/gnn_fraud_detection_screen.dart';
import 'screens/fraudfusion_ensemble_screen.dart';
import 'screens/mcmc_bayesian_risk_screen.dart';
import 'screens/cocoindex_pipeline_screen.dart';
import 'screens/epr_kgqa_screen.dart';
import 'screens/falkordb_graph_screen.dart';
import 'screens/ollama_llm_screen.dart';
import 'screens/art_adversarial_screen.dart';
import 'screens/mojaloop_pisp_screen.dart';
import 'screens/tb_multicurrency_screen.dart';
import 'screens/kafka_governance_screen.dart';
// Production Hardening — 30 screens
import 'screens/cors_gateway_screen.dart';
import 'screens/auth_enforcer_screen.dart';
import 'screens/request_validator_screen.dart';
import 'screens/api_versioning_screen.dart';
import 'screens/apm_sentry_screen.dart';
import 'screens/secrets_rotation_screen.dart';
import 'screens/db_migration_manager_screen.dart';
import 'screens/connection_pooler_screen.dart';
import 'screens/backup_manager_screen.dart';
import 'screens/unit_test_runner_screen.dart';
import 'screens/e2e_orchestrator_screen.dart';
import 'screens/contract_test_screen.dart';
import 'screens/load_test_runner_screen.dart';
import 'screens/otel_collector_screen.dart';
import 'screens/changelog_generator_screen.dart';
import 'screens/helm_validator_screen.dart';
import 'screens/accessibility_auditor_screen.dart';
import 'screens/i18n_service_screen.dart';
import 'screens/credit_scoring_screen.dart';
import 'screens/debt_collection_screen.dart';
import 'screens/account_closure_screen.dart';
import 'screens/dormancy_management_screen.dart';
import 'screens/interest_computation_screen.dart';
import 'screens/fee_management_screen.dart';
import 'screens/tax_reporting_screen.dart';
import 'screens/regulatory_sandbox_screen.dart';
import 'screens/api_analytics_screen.dart';
import 'screens/developer_portal_screen.dart';
import 'screens/customer_360_dashboard_screen.dart';
import 'screens/realtime_pricing_screen.dart';
import 'screens/lakehouse_cdc_events_screen.dart';
import 'screens/lakehouse_clients_screen.dart';
import 'screens/lakehouse_domain_cdc_screen.dart';
import 'screens/lakehouse_lineage_edges_screen.dart';
import 'screens/lakehouse_lineage_nodes_screen.dart';
import 'screens/lakehouse_materialized_views_screen.dart';
import 'screens/lakehouse_query_federation_screen.dart';
import 'screens/lakehouse_screen.dart';
import 'screens/lc_amendments_screen.dart';
import 'screens/lcr_nsfr_screen.dart';
import 'screens/leasing_screen.dart';
import 'screens/ledger_screen.dart';
import 'screens/ledger_sync_screen.dart';
import 'screens/limit_management_screen.dart';
import 'screens/liveness_detection_screen.dart';
import 'screens/load_testing_screen.dart';
import 'screens/loan_accounts_screen.dart';
import 'screens/loan_calculator_screen.dart';
import 'screens/loan_origination_screen.dart';
import 'screens/loan_products_screen.dart';
import 'screens/loans_screen.dart';
import 'screens/locker_screen.dart';
import 'screens/maker_checker_screen.dart';
import 'screens/mandate_management_screen.dart';
import 'screens/messaging_gateway_screen.dart';
import 'screens/microfinance_engine_screen.dart';
import 'screens/microfinance_screen.dart';
import 'screens/mojaloop_admin_limits_screen.dart';
import 'screens/mojaloop_admin_participants_screen.dart';
import 'screens/mojaloop_callback_endpoints_screen.dart';
import 'screens/mojaloop_callbacks_screen.dart';
import 'screens/mojaloop_corridors_screen.dart';
import 'screens/mojaloop_ilp_packets_screen.dart';
import 'screens/mojaloop_screen.dart';
import 'screens/mojaloop_settlement_models_screen.dart';
import 'screens/mojaloop_settlement_windows_screen.dart';
import 'screens/mojaloop_tb_bridge_configs_screen.dart';
import 'screens/mojaloop_tb_bridge_entries_screen.dart';
import 'screens/money_market_screen.dart';
import 'screens/mortgage_screen.dart';
import 'screens/multi_currency_fx_screen.dart';
import 'screens/multi_entity_screen.dart';
import 'screens/murabaha_calculator_screen.dart';
import 'screens/nibss_direct_debit_screen.dart';
import 'screens/notification_center_screen.dart';
import 'screens/notification_prefs_screen.dart';
import 'screens/notifications_engine_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/offline_resilience_screen.dart';
import 'screens/offline_transactions_screen.dart';
import 'screens/open_banking_screen.dart';
import 'screens/openappsec_events_screen.dart';
import 'screens/openappsec_rules_screen.dart';
import 'screens/opensearch_screen.dart';
import 'screens/operations_center_screen.dart';
import 'screens/otc_derivatives_screen.dart';
import 'screens/otel_configs_screen.dart';
import 'screens/partner_onboarding_admin_screen.dart';
import 'screens/partner_onboarding_portal_screen.dart';
import 'screens/payment_investigation_screen.dart';
import 'screens/payment_transactions_screen.dart';
import 'screens/payments_hub_screen.dart';
import 'screens/pbac_engine_screen.dart';
import 'screens/pension_screen.dart';
import 'screens/pep_database_screen.dart';
import 'screens/performance_cache_screen.dart';
import 'screens/performance_metrics_screen.dart';
import 'screens/permify_screen.dart';
import 'screens/pg_connection_pools_screen.dart';
import 'screens/pg_index_advisory_screen.dart';
import 'screens/pg_query_profiles_screen.dart';
import 'screens/pg_slow_queries_screen.dart';
import 'screens/pg_table_stats_screen.dart';
import 'screens/pg_tuning_params_screen.dart';
import 'screens/plugin_marketplace_screen.dart';
import 'screens/portfolio_mgmt_screen.dart';
import 'screens/pos_terminal_screen.dart';
import 'screens/pricing_model_screen.dart';
import 'screens/product_catalog_screen.dart';
import 'screens/product_factory_screen.dart';
import 'screens/project_finance_screen.dart';
import 'screens/prometheus_metrics_screen.dart';
import 'screens/proxy_routes_screen.dart';
import 'screens/qr_payments_screen.dart';
import 'screens/ransomware_protection_screen.dart';
import 'screens/rate_cascade_screen.dart';
import 'screens/rate_limiting_screen.dart';
import 'screens/reconciliation_screen.dart';
import 'screens/regulatory_automation_screen.dart';
import 'screens/regulatory_calendar_screen.dart';
import 'screens/regulatory_reporting_screen.dart';
import 'screens/relationship_pricing_screen.dart';
import 'screens/remittance_screen.dart';
import 'screens/report_generation_screen.dart';
import 'screens/reporting_screen.dart';
import 'screens/resilience_dashboard_screen.dart';
import 'screens/retry_policies_screen.dart';
import 'screens/risk_scoring_screen.dart';
import 'screens/safe_deposit_screen.dart';
import 'screens/salary_processing_screen.dart';
import 'screens/sar_reports_screen.dart';
import 'screens/savings_products_screen.dart';
import 'screens/securities_trading_screen.dart';
import 'screens/security_hardening_screen.dart';
import 'screens/seed_registry_screen.dart';
import 'screens/self_service_txns_screen.dart';
import 'screens/service_catalog_screen.dart';
import 'screens/service_health_screen.dart';
import 'screens/service_registry_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/signature_verification_screen.dart';
import 'screens/sms_banking_screen.dart';
import 'screens/sms_email_gateway_screen.dart';
import 'screens/staff_management_screen.dart';
import 'screens/standing_charges_screen.dart';
import 'screens/standing_instructions_screen.dart';
import 'screens/standing_orders_screen.dart';
import 'screens/statement_generator_screen.dart';
import 'screens/statement_history_screen.dart';
import 'screens/stress_testing_screen.dart';
import 'screens/sukuk_management_screen.dart';
import 'screens/supply_chain_finance_screen.dart';
import 'screens/swift_messaging_screen.dart';
import 'screens/syndicated_loans_screen.dart';
import 'screens/takaful_management_screen.dart';
import 'screens/tb_pg_balance_cache_configs_screen.dart';
import 'screens/tb_pg_balance_cache_entries_screen.dart';
import 'screens/tb_pg_reconciliation_rules_screen.dart';
import 'screens/tb_pg_reconciliation_runs_screen.dart';
import 'screens/tb_pg_saga_definitions_screen.dart';
import 'screens/tb_pg_saga_executions_screen.dart';
import 'screens/tb_pg_sync_configs_screen.dart';
import 'screens/tb_pg_sync_events_screen.dart';
import 'screens/teller_screen.dart';
import 'screens/temporal_sagas_screen.dart';
import 'screens/tenant_isolation_screen.dart';
import 'screens/tenant_metering_screen.dart';
import 'screens/tenant_provisioning_screen.dart';
import 'screens/tigerbeetle_ledger_screen.dart';
import 'screens/trade_finance_screen.dart';
import 'screens/transfers_screen.dart';
import 'screens/treasury_investments_screen.dart';
import 'screens/treasury_liquidity_screen.dart';
import 'screens/treasury_screen.dart';
import 'screens/trust_estate_screen.dart';
import 'screens/ussd_banking_screen.dart';
import 'screens/utility_payments_screen.dart';
import 'screens/virtual_accounts_screen.dart';
import 'screens/wakala_investment_screen.dart';
import 'screens/watchlist_screen.dart';
import 'screens/wealth_mgmt_screen.dart';
import 'screens/webhook_deliveries_screen.dart';
import 'screens/webhook_engine_screen.dart';
import 'screens/webhook_subscriptions_screen.dart';
import 'screens/white_label_config_screen.dart';
import 'screens/white_label_engine_screen.dart';
import 'screens/workflow_definitions_screen.dart';
import 'screens/workflow_engine_screen.dart';
import 'screens/workflow_instances_screen.dart';
import 'widgets/api_list_screen.dart';
import 'services/api_service.dart';
import 'services/cache_service.dart';
import 'services/connectivity_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await CacheService.instance.initialize();
  runApp(const BankApp());
}

class BankApp extends StatelessWidget {
  const BankApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '54Bank',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.green.shade800),
        useMaterial3: true,
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const HomeScreen(),
          '/account-opening': (context) => const AccountOpeningScreen(),
          '/account-statements': (context) => const AccountStatementsScreen(),
          '/accounting-rules': (context) => const AccountingRulesScreen(),
          '/admin-dashboard': (context) => const AdminDashboardScreen(),
          '/agent-banking': (context) => const AgentBankingScreen(),
          '/agent-performance': (context) => const AgentPerformanceScreen(),
          '/agricultural-insurance': (context) => const AgriculturalInsuranceScreen(),
          '/ai-agent-hub': (context) => const AiAgentHubScreen(),
          '/ai-fraud-detection': (context) => const AiFraudDetectionScreen(),
          '/stakeholder-kpi-dashboard': (context) => const StakeholderKpiDashboardScreen(),
          '/alert-rules': (context) => const AlertRulesScreen(),
          '/analytics-widgets': (context) => const AnalyticsWidgetsScreen(),
          '/api-marketplace': (context) => const ApiMarketplaceScreen(),
          '/apisix-plugins': (context) => const ApisixPluginsScreen(),
          '/apisix-routes': (context) => const ApisixRoutesScreen(),
          '/apisix-upstreams': (context) => const ApisixUpstreamsScreen(),
          '/approval-workflow': (context) => const ApprovalWorkflowScreen(),
          '/atm-management': (context) => const AtmManagementScreen(),
          '/audit-trail': (context) => const AuditTrailScreen(),
          '/bandwidth-adaptation': (context) => const BandwidthAdaptationScreen(),
          '/bank-guarantees': (context) => const BankGuaranteesScreen(),
          '/basel-engine': (context) => const BaselEngineScreen(),
          '/batch-eod': (context) => const BatchEodScreen(),
          '/batch-processing': (context) => const BatchProcessingScreen(),
          '/beneficiary-mgmt': (context) => const BeneficiaryMgmtScreen(),
          '/billing-engine': (context) => const BillingEngineScreen(),
          '/billing-event-processor': (context) => const BillingEventProcessorScreen(),
          '/billing-orchestrator': (context) => const BillingOrchestratorScreen(),
          '/billing-rbac': (context) => const BillingRbacScreen(),
          '/biometric-auth': (context) => const BiometricAuthScreen(),
          '/branch-operations': (context) => const BranchOperationsScreen(),
          '/branded-comms': (context) => const BrandedCommsScreen(),
          '/bulk-payments': (context) => const BulkPaymentsScreen(),
          '/card-fraud-rules': (context) => const CardFraudRulesScreen(),
          '/card-management': (context) => const CardManagementScreen(),
          '/card-tokens': (context) => const CardTokensScreen(),
          '/cards': (context) => const CardsScreen(),
          '/cash-management': (context) => const CashManagementScreen(),
          '/cash-pooling': (context) => const CashPoolingScreen(),
          '/cbn-returns': (context) => const CbnReturnsScreen(),
          '/channel-management': (context) => const ChannelManagementScreen(),
          '/chart-of-accounts': (context) => const ChartOfAccountsScreen(),
          '/chatbot': (context) => const ChatbotScreen(),
          '/cheque-clearing': (context) => const ChequeClearingScreen(),
          '/cheque-imaging': (context) => const ChequeImagingScreen(),
          '/cif-management': (context) => const CifManagementScreen(),
          '/circuit-breaker-dashboard': (context) => const CircuitBreakerDashboardScreen(),
          '/collateral': (context) => const CollateralScreen(),
          '/collateral-valuation': (context) => const CollateralValuationScreen(),
          '/complaints': (context) => const ComplaintsScreen(),
          '/compliance-checks': (context) => const ComplianceChecksScreen(),
          '/component-showcase': (context) => const ComponentShowcaseScreen(),
          '/contingent-liabilities': (context) => const ContingentLiabilitiesScreen(),
          '/correspondent-banking': (context) => const CorrespondentBankingScreen(),
          '/credit-bureau': (context) => const CreditBureauScreen(),
          '/credit-facilities': (context) => const CreditFacilitiesScreen(),
          '/credit-risk': (context) => const CreditRiskScreen(),
          '/custody-service': (context) => const CustodyServiceScreen(),
          '/custom-domain': (context) => const CustomDomainScreen(),
          '/customer-360': (context) => const Customer360Screen(),
          '/customer-bills': (context) => const CustomerBillsScreen(),
          '/customer-cards': (context) => const CustomerCardsScreen(),
          '/customer-dashboard': (context) => const CustomerDashboardScreen(),
          '/customer-engagement': (context) => const CustomerEngagementScreen(),
          '/customer-feedback': (context) => const CustomerFeedbackScreen(),
          '/customer-insights': (context) => const CustomerInsightsScreen(),
          '/customer-loans': (context) => const CustomerLoansScreen(),
          '/customer-notifications': (context) => const CustomerNotificationsScreen(),
          '/customer-onboarding': (context) => const CustomerOnboardingScreen(),
          '/customer-qr': (context) => const CustomerQrScreen(),
          '/customer-savings': (context) => const CustomerSavingsScreen(),
          '/customer-segments': (context) => const CustomerSegmentsScreen(),
          '/customer-settings': (context) => const CustomerSettingsScreen(),
          '/customer-statements': (context) => const CustomerStatementsScreen(),
          '/customer-transfers': (context) => const CustomerTransfersScreen(),
          '/customers': (context) => const CustomersScreen(),
          '/dapr-sidecar': (context) => const DaprSidecarScreen(),
          '/data-export': (context) => const DataExportScreen(),
          '/database-persistence': (context) => const DatabasePersistenceScreen(),
          '/db-admin': (context) => const DbAdminScreen(),
          '/ddos-protection': (context) => const DdosProtectionScreen(),
          '/diaspora-banking': (context) => const DiasporaBankingScreen(),
          '/disaster-recovery': (context) => const DisasterRecoveryScreen(),
          '/dispute-management': (context) => const DisputeManagementScreen(),
          '/doc-collections': (context) => const DocCollectionsScreen(),
          '/document-management': (context) => const DocumentManagementScreen(),
          '/dormancy-mgmt': (context) => const DormancyMgmtScreen(),
          '/e2e-tests': (context) => const E2eTestsScreen(),
          '/education-loans': (context) => const EducationLoansScreen(),
          '/embedded-finance': (context) => const EmbeddedFinanceScreen(),
          '/enaira-cbdc': (context) => const EnairaCbdcScreen(),
          '/eod-processor': (context) => const EodProcessorScreen(),
          '/erp-next': (context) => const ErpNextScreen(),
          '/error-catalog': (context) => const ErrorCatalogScreen(),
          '/error-telemetry': (context) => const ErrorTelemetryScreen(),
          '/escrow': (context) => const EscrowScreen(),
          '/esg-banking': (context) => const EsgBankingScreen(),
          '/esusu': (context) => const EsusuScreen(),
          '/etd-trading': (context) => const EtdTradingScreen(),
          '/etl-pipelines': (context) => const EtlPipelinesScreen(),
          '/event-bus': (context) => const EventBusScreen(),
          '/event-streaming': (context) => const EventStreamingScreen(),
          '/exam-management': (context) => const ExamManagementScreen(),
          '/expense-mgmt': (context) => const ExpenseMgmtScreen(),
          '/face-match': (context) => const FaceMatchScreen(),
          '/factoring': (context) => const FactoringScreen(),
          '/fatca-crs': (context) => const FatcaCrsScreen(),
          '/feature-flag-engine': (context) => const FeatureFlagEngineScreen(),
          '/fee-schedules': (context) => const FeeSchedulesScreen(),
          '/fixed-assets': (context) => const FixedAssetsScreen(),
          '/fixed-deposits': (context) => const FixedDepositsScreen(),
          '/fluvio-streams': (context) => const FluvioStreamsScreen(),
          '/fraud-alerts': (context) => const FraudAlertsScreen(),
          '/fraud-detection': (context) => const FraudDetectionScreen(),
          '/fraud-rules': (context) => const FraudRulesScreen(),
          '/fx-dealing-room': (context) => const FxDealingRoomScreen(),
          '/fx-positions': (context) => const FxPositionsScreen(),
          '/fx-rates': (context) => const FxRatesScreen(),
          '/fx-revaluation': (context) => const FxRevaluationScreen(),
          '/gl-accounts': (context) => const GlAccountsScreen(),
          '/gl-engine': (context) => const GlEngineScreen(),
          '/graduated-rollout': (context) => const GraduatedRolloutScreen(),
          '/grafana-dashboards': (context) => const GrafanaDashboardsScreen(),
          '/ha-middleware': (context) => const HAMiddlewareScreen(),
          '/ha-services': (context) => const HAServicesScreen(),
          '/ha-zones': (context) => const HAZonesScreen(),
          '/home': (context) => const HomeScreen(),
          '/idempotency-dashboard': (context) => const IdempotencyDashboardScreen(),
          '/identity-channels': (context) => const IdentityChannelsScreen(),
          '/ifrs9-engine': (context) => const Ifrs9EngineScreen(),
          '/infra-kafka': (context) => const InfraKafkaScreen(),
          '/infra-lakehouse': (context) => const InfraLakehouseScreen(),
          '/infra-opensearch': (context) => const InfraOpensearchScreen(),
          '/infra-postgres': (context) => const InfraPostgresScreen(),
          '/infra-redis': (context) => const InfraRedisScreen(),
          '/infra-temporal': (context) => const InfraTemporalScreen(),
          '/infra-tigerbeetle': (context) => const InfraTigerbeetleScreen(),
          '/insurance': (context) => const InsuranceScreen(),
          '/integration-tests': (context) => const IntegrationTestsScreen(),
          '/interbank-lending': (context) => const InterbankLendingScreen(),
          '/interbank-settlement': (context) => const InterbankSettlementScreen(),
          '/interest-accrual': (context) => const InterestAccrualScreen(),
          '/interest-rate': (context) => const InterestRateScreen(),
          '/inventory-finance': (context) => const InventoryFinanceScreen(),
          '/inventory': (context) => const InventoryScreen(),
          '/islamic-banking': (context) => const IslamicBankingScreen(),
          '/iso20022-hub': (context) => const Iso20022HubScreen(),
          '/journal-entries': (context) => const JournalEntriesScreen(),
          '/jwt-auth': (context) => const JwtAuthScreen(),
          '/kafka-event-bus': (context) => const KafkaEventBusScreen(),
          '/kafka-streaming': (context) => const KafkaStreamingScreen(),
          '/keda-autoscaling': (context) => const KedaAutoscalingScreen(),
          '/keda-policies': (context) => const KedaPoliciesScreen(),
          '/keycloak-clients': (context) => const KeycloakClientsScreen(),
          '/keycloak-idps': (context) => const KeycloakIdPsScreen(),
          '/keycloak-realms': (context) => const KeycloakRealmsScreen(),
          '/keycloak-roles': (context) => const KeycloakRolesScreen(),
          '/keycloak': (context) => const KeycloakScreen(),
          '/kyb-engine': (context) => const KybEngineScreen(),
          '/kyb-triggers': (context) => const KybTriggersScreen(),
          '/kyc-aml': (context) => const KycAmlScreen(),
          '/kyc-engine': (context) => const KycEngineScreen(),
          '/kyc-event-rules': (context) => const KycEventRulesScreen(),
          '/kyc-overrides': (context) => const KycOverridesScreen(),
          '/kyc-service-gates': (context) => const KycServiceGatesScreen(),
          '/kyc-triggers': (context) => const KycTriggersScreen(),
          '/kyc-tiered-dashboard': (context) => const KycTieredDashboardScreen(),
          '/bvn-nin-verification': (context) => const BvnNinVerificationScreen(),
          '/nfiu-ctr-str-filing': (context) => const NfiuCtrStrFilingScreen(),
          '/sanctions-screening': (context) => const SanctionsScreeningScreen(),
          '/cac-verification': (context) => const CacVerificationScreen(),
          '/txn-monitoring-rules': (context) => const TxnMonitoringRulesScreen(),
          '/risk-based-approach': (context) => const RiskBasedApproachScreen(),
          '/pep-enhanced-dd': (context) => const PepEnhancedDdScreen(),
          '/ubo-ownership-graph': (context) => const UboOwnershipGraphScreen(),
          '/multi-bureau-check': (context) => const MultiBureauCheckScreen(),
          '/address-verification': (context) => const AddressVerificationScreen(),
          '/corporate-doc-verify': (context) => const CorporateDocVerifyScreen(),
          '/kyc-analytics-dash': (context) => const KycAnalyticsDashScreen(),
          '/video-kyc': (context) => const VideoKycScreen(),
          '/continuous-liveness': (context) => const ContinuousLivenessScreen(),
          '/kyc-workflow': (context) => const KycWorkflowScreen(),
          '/kyc-self-service': (context) => const KycSelfServiceScreen(),
          '/agent-kyc-capture': (context) => const AgentKycCaptureScreen(),
          '/adverse-media': (context) => const AdverseMediaScreen(),
          '/corporate-monitoring': (context) => const CorporateMonitoringScreen(),
          '/kyc-data-quality': (context) => const KycDataQualityScreen(),
          '/efass-kyc-returns': (context) => const EfassKycReturnsScreen(),
          '/kyc-enhanced-summary': (context) => const KycEnhancedSummaryScreen(),
          '/gnn-fraud-detection': (context) => const GnnFraudDetectionScreen(),
          '/fraudfusion-ensemble': (context) => const FraudfusionEnsembleScreen(),
          '/mcmc-bayesian-risk': (context) => const McmcBayesianRiskScreen(),
          '/cocoindex-pipeline': (context) => const CocoindexPipelineScreen(),
          '/epr-kgqa': (context) => const EprKgqaScreen(),
          '/falkordb-graph': (context) => const FalkordbGraphScreen(),
          '/ollama-llm': (context) => const OllamaLlmScreen(),
          '/art-adversarial': (context) => const ArtAdversarialScreen(),
          '/mojaloop-pisp': (context) => const MojaloopPispScreen(),
          '/tb-multicurrency': (context) => const TbMulticurrencyScreen(),
          '/kafka-governance': (context) => const KafkaGovernanceScreen(),
          // Production Hardening
          '/cors-gateway': (context) => const CorsGatewayScreen(),
          '/auth-enforcer': (context) => const AuthEnforcerScreen(),
          '/request-validator': (context) => const RequestValidatorScreen(),
          '/api-versioning': (context) => const ApiVersioningScreen(),
          '/apm-sentry': (context) => const ApmSentryScreen(),
          '/secrets-rotation': (context) => const SecretsRotationScreen(),
          '/db-migration-manager': (context) => const DbMigrationManagerScreen(),
          '/connection-pooler': (context) => const ConnectionPoolerScreen(),
          '/backup-manager': (context) => const BackupManagerScreen(),
          '/unit-test-runner': (context) => const UnitTestRunnerScreen(),
          '/e2e-orchestrator': (context) => const E2eOrchestratorScreen(),
          '/contract-tests': (context) => const ContractTestScreen(),
          '/load-test-runner': (context) => const LoadTestRunnerScreen(),
          '/otel-collector': (context) => const OtelCollectorScreen(),
          '/changelog-generator': (context) => const ChangelogGeneratorScreen(),
          '/helm-validator': (context) => const HelmValidatorScreen(),
          '/accessibility-auditor': (context) => const AccessibilityAuditorScreen(),
          '/i18n-service': (context) => const I18nServiceScreen(),
          '/credit-scoring': (context) => const CreditScoringScreen(),
          '/debt-collection': (context) => const DebtCollectionScreen(),
          '/account-closure': (context) => const AccountClosureScreen(),
          '/dormancy-management': (context) => const DormancyManagementScreen(),
          '/interest-computation': (context) => const InterestComputationScreen(),
          '/fee-management': (context) => const FeeManagementScreen(),
          '/tax-reporting': (context) => const TaxReportingScreen(),
          '/regulatory-sandbox': (context) => const RegulatorySandboxScreen(),
          '/api-analytics': (context) => const ApiAnalyticsScreen(),
          '/developer-portal': (context) => const DeveloperPortalScreen(),
          '/customer-360-dashboard': (context) => const Customer360DashboardScreen(),
          '/realtime-pricing': (context) => const RealtimePricingScreen(),
          '/lakehouse-cdc-events': (context) => const LakehouseCDCEventsScreen(),
          '/lakehouse-clients': (context) => const LakehouseClientsScreen(),
          '/lakehouse-domain-cdc': (context) => const LakehouseDomainCDCScreen(),
          '/lakehouse-lineage-edges': (context) => const LakehouseLineageEdgesScreen(),
          '/lakehouse-lineage-nodes': (context) => const LakehouseLineageNodesScreen(),
          '/lakehouse-materialized-views': (context) => const LakehouseMaterializedViewsScreen(),
          '/lakehouse-query-federation': (context) => const LakehouseQueryFederationScreen(),
          '/lakehouse': (context) => const LakehouseScreen(),
          '/lc-amendments': (context) => const LcAmendmentsScreen(),
          '/lcr-nsfr': (context) => const LcrNsfrScreen(),
          '/leasing': (context) => const LeasingScreen(),
          '/ledger': (context) => const LedgerScreen(),
          '/ledger-sync': (context) => const LedgerSyncScreen(),
          '/limit-management': (context) => const LimitManagementScreen(),
          '/liveness-detection': (context) => const LivenessDetectionScreen(),
          '/load-testing': (context) => const LoadTestingScreen(),
          '/loan-accounts': (context) => const LoanAccountsScreen(),
          '/loan-calculator': (context) => const LoanCalculatorScreen(),
          '/loan-origination': (context) => const LoanOriginationScreen(),
          '/loan-products': (context) => const LoanProductsScreen(),
          '/loans': (context) => const LoansScreen(),
          '/locker': (context) => const LockerScreen(),
          '/maker-checker': (context) => const MakerCheckerScreen(),
          '/mandate-management': (context) => const MandateManagementScreen(),
          '/messaging-gateway': (context) => const MessagingGatewayScreen(),
          '/microfinance-engine': (context) => const MicrofinanceEngineScreen(),
          '/microfinance': (context) => const MicrofinanceScreen(),
          '/mojaloop-admin-limits': (context) => const MojaloopAdminLimitsScreen(),
          '/mojaloop-admin-participants': (context) => const MojaloopAdminParticipantsScreen(),
          '/mojaloop-callback-endpoints': (context) => const MojaloopCallbackEndpointsScreen(),
          '/mojaloop-callbacks': (context) => const MojaloopCallbacksScreen(),
          '/mojaloop-corridors': (context) => const MojaloopCorridorsScreen(),
          '/mojaloop-ilp-packets': (context) => const MojaloopILPPacketsScreen(),
          '/mojaloop': (context) => const MojaloopScreen(),
          '/mojaloop-settlement-models': (context) => const MojaloopSettlementModelsScreen(),
          '/mojaloop-settlement-windows': (context) => const MojaloopSettlementWindowsScreen(),
          '/mojaloop-tb-bridge-configs': (context) => const MojaloopTBBridgeConfigsScreen(),
          '/mojaloop-tb-bridge-entries': (context) => const MojaloopTBBridgeEntriesScreen(),
          '/money-market': (context) => const MoneyMarketScreen(),
          '/mortgage': (context) => const MortgageScreen(),
          '/multi-currency-fx': (context) => const MultiCurrencyFxScreen(),
          '/multi-entity': (context) => const MultiEntityScreen(),
          '/murabaha-calculator': (context) => const MurabahaCalculatorScreen(),
          '/nibss-direct-debit': (context) => const NibssDirectDebitScreen(),
          '/notification-center': (context) => const NotificationCenterScreen(),
          '/notification-prefs': (context) => const NotificationPrefsScreen(),
          '/notifications-engine': (context) => const NotificationsEngineScreen(),
          '/notifications': (context) => const NotificationsScreen(),
          '/offline-resilience': (context) => const OfflineResilienceScreen(),
          '/offline-transactions': (context) => const OfflineTransactionsScreen(),
          '/open-banking': (context) => const OpenBankingScreen(),
          '/openappsec-events': (context) => const OpenappsecEventsScreen(),
          '/openappsec-rules': (context) => const OpenappsecRulesScreen(),
          '/opensearch': (context) => const OpensearchScreen(),
          '/operations-center': (context) => const OperationsCenterScreen(),
          '/otc-derivatives': (context) => const OtcDerivativesScreen(),
          '/otel-configs': (context) => const OtelConfigsScreen(),
          '/partner-onboarding-admin': (context) => const PartnerOnboardingAdminScreen(),
          '/partner-onboarding-portal': (context) => const PartnerOnboardingPortalScreen(),
          '/payment-investigation': (context) => const PaymentInvestigationScreen(),
          '/payment-transactions': (context) => const PaymentTransactionsScreen(),
          '/payments-hub': (context) => const PaymentsHubScreen(),
          '/pbac-engine': (context) => const PbacEngineScreen(),
          '/pension': (context) => const PensionScreen(),
          '/pep-database': (context) => const PepDatabaseScreen(),
          '/performance-cache': (context) => const PerformanceCacheScreen(),
          '/performance-metrics': (context) => const PerformanceMetricsScreen(),
          '/permify': (context) => const PermifyScreen(),
          '/pg-connection-pools': (context) => const PgConnectionPoolsScreen(),
          '/pg-index-advisory': (context) => const PgIndexAdvisoryScreen(),
          '/pg-query-profiles': (context) => const PgQueryProfilesScreen(),
          '/pg-slow-queries': (context) => const PgSlowQueriesScreen(),
          '/pg-table-stats': (context) => const PgTableStatsScreen(),
          '/pg-tuning-params': (context) => const PgTuningParamsScreen(),
          '/plugin-marketplace': (context) => const PluginMarketplaceScreen(),
          '/portfolio-mgmt': (context) => const PortfolioMgmtScreen(),
          '/pos-terminal': (context) => const PosTerminalScreen(),
          '/pricing-model': (context) => const PricingModelScreen(),
          '/product-catalog': (context) => const ProductCatalogScreen(),
          '/product-factory': (context) => const ProductFactoryScreen(),
          '/project-finance': (context) => const ProjectFinanceScreen(),
          '/prometheus-metrics': (context) => const PrometheusMetricsScreen(),
          '/proxy-routes': (context) => const ProxyRoutesScreen(),
          '/qr-payments': (context) => const QrPaymentsScreen(),
          '/ransomware-protection': (context) => const RansomwareProtectionScreen(),
          '/rate-cascade': (context) => const RateCascadeScreen(),
          '/rate-limiting': (context) => const RateLimitingScreen(),
          '/reconciliation': (context) => const ReconciliationScreen(),
          '/regulatory-automation': (context) => const RegulatoryAutomationScreen(),
          '/regulatory-calendar': (context) => const RegulatoryCalendarScreen(),
          '/regulatory-reporting': (context) => const RegulatoryReportingScreen(),
          '/relationship-pricing': (context) => const RelationshipPricingScreen(),
          '/remittance': (context) => const RemittanceScreen(),
          '/report-generation': (context) => const ReportGenerationScreen(),
          '/reporting': (context) => const ReportingScreen(),
          '/resilience-dashboard': (context) => const ResilienceDashboardScreen(),
          '/retry-policies': (context) => const RetryPoliciesScreen(),
          '/risk-scoring': (context) => const RiskScoringScreen(),
          '/safe-deposit': (context) => const SafeDepositScreen(),
          '/salary-processing': (context) => const SalaryProcessingScreen(),
          '/sar-reports': (context) => const SarReportsScreen(),
          '/savings-products': (context) => const SavingsProductsScreen(),
          '/securities-trading': (context) => const SecuritiesTradingScreen(),
          '/security-hardening': (context) => const SecurityHardeningScreen(),
          '/seed-registry': (context) => const SeedRegistryScreen(),
          '/self-service-txns': (context) => const SelfServiceTxnsScreen(),
          '/service-catalog': (context) => const ServiceCatalogScreen(),
          '/service-health': (context) => const ServiceHealthScreen(),
          '/service-registry': (context) => const ServiceRegistryScreen(),
          '/settings': (context) => const SettingsScreen(),
          '/signature-verification': (context) => const SignatureVerificationScreen(),
          '/sms-banking': (context) => const SmsBankingScreen(),
          '/sms-email-gateway': (context) => const SmsEmailGatewayScreen(),
          '/staff-management': (context) => const StaffManagementScreen(),
          '/standing-charges': (context) => const StandingChargesScreen(),
          '/standing-instructions': (context) => const StandingInstructionsScreen(),
          '/standing-orders': (context) => const StandingOrdersScreen(),
          '/statement-generator': (context) => const StatementGeneratorScreen(),
          '/statement-history': (context) => const StatementHistoryScreen(),
          '/stress-testing': (context) => const StressTestingScreen(),
          '/sukuk-management': (context) => const SukukManagementScreen(),
          '/supply-chain-finance': (context) => const SupplyChainFinanceScreen(),
          '/swift-messaging': (context) => const SwiftMessagingScreen(),
          '/syndicated-loans': (context) => const SyndicatedLoansScreen(),
          '/takaful-management': (context) => const TakafulManagementScreen(),
          '/tb-pg-balance-cache-configs': (context) => const TBPGBalanceCacheConfigsScreen(),
          '/tb-pg-balance-cache-entries': (context) => const TBPGBalanceCacheEntriesScreen(),
          '/tb-pg-reconciliation-rules': (context) => const TBPGReconciliationRulesScreen(),
          '/tb-pg-reconciliation-runs': (context) => const TBPGReconciliationRunsScreen(),
          '/tb-pg-saga-definitions': (context) => const TBPGSagaDefinitionsScreen(),
          '/tb-pg-saga-executions': (context) => const TBPGSagaExecutionsScreen(),
          '/tb-pg-sync-configs': (context) => const TBPGSyncConfigsScreen(),
          '/tb-pg-sync-events': (context) => const TBPGSyncEventsScreen(),
          '/teller': (context) => const TellerScreen(),
          '/temporal-sagas': (context) => const TemporalSagasScreen(),
          '/tenant-isolation': (context) => const TenantIsolationScreen(),
          '/tenant-metering': (context) => const TenantMeteringScreen(),
          '/tenant-provisioning': (context) => const TenantProvisioningScreen(),
          '/tigerbeetle-ledger': (context) => const TigerbeetleLedgerScreen(),
          '/trade-finance': (context) => const TradeFinanceScreen(),
          '/transfers': (context) => const TransfersScreen(),
          '/treasury-investments': (context) => const TreasuryInvestmentsScreen(),
          '/treasury-liquidity': (context) => const TreasuryLiquidityScreen(),
          '/treasury': (context) => const TreasuryScreen(),
          '/trust-estate': (context) => const TrustEstateScreen(),
          '/ussd-banking': (context) => const UssdBankingScreen(),
          '/utility-payments': (context) => const UtilityPaymentsScreen(),
          '/virtual-accounts': (context) => const VirtualAccountsScreen(),
          '/wakala-investment': (context) => const WakalaInvestmentScreen(),
          '/watchlist': (context) => const WatchlistScreen(),
          '/wealth-mgmt': (context) => const WealthMgmtScreen(),
          '/webhook-deliveries': (context) => const WebhookDeliveriesScreen(),
          '/webhook-engine': (context) => const WebhookEngineScreen(),
          '/webhook-subscriptions': (context) => const WebhookSubscriptionsScreen(),
          '/white-label-config': (context) => const WhiteLabelConfigScreen(),
          '/white-label-engine': (context) => const WhiteLabelEngineScreen(),
          '/workflow-definitions': (context) => const WorkflowDefinitionsScreen(),
          '/workflow-engine': (context) => const WorkflowEngineScreen(),
          '/workflow-instances': (context) => const WorkflowInstancesScreen(),
      },
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {

  // ── Navigation Data ─────────────────────────────────────────────────────
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  static final List<Map<String, dynamic>> _navCategories = [
    {'name': 'Overview', 'icon': Icons.dashboard, 'items': <Map<String, dynamic>>[
      {'label': 'Admin Dashboard', 'path': '/admin-dashboard', 'icon': Icons.dashboard},
      {'label': 'Alert Rules', 'path': '/alert-rules', 'icon': Icons.notifications},
      {'label': 'Analytics Widgets', 'path': '/analytics-widgets', 'icon': Icons.analytics},
      {'label': 'Circuit Breaker Dashboard', 'path': '/circuit-breaker-dashboard', 'icon': Icons.dashboard},
      {'label': 'Customer Dashboard', 'path': '/customer-dashboard', 'icon': Icons.people},
      {'label': 'Fraud Alerts', 'path': '/fraud-alerts', 'icon': Icons.warning},
      {'label': 'Grafana Dashboards', 'path': '/grafana-dashboards', 'icon': Icons.dashboard},
      {'label': 'Home', 'path': '/home', 'icon': Icons.circle},
      {'label': 'Idempotency Dashboard', 'path': '/idempotency-dashboard', 'icon': Icons.dashboard},
      {'label': 'CBN Tiered KYC', 'path': '/kyc-tiered-dashboard', 'icon': Icons.dashboard},
      {'label': 'Transaction Monitoring', 'path': '/txn-monitoring-rules', 'icon': Icons.monitor_heart},
      {'label': 'KYC Analytics', 'path': '/kyc-analytics-dash', 'icon': Icons.analytics},
      {'label': 'Corporate Monitoring', 'path': '/corporate-monitoring', 'icon': Icons.monitor_heart},
      {'label': 'API Analytics', 'path': '/api-analytics', 'icon': Icons.api},
      {'label': 'Customer 360', 'path': '/customer-360-dashboard', 'icon': Icons.people},
      {'label': 'Resilience Dashboard', 'path': '/resilience-dashboard', 'icon': Icons.dashboard},
      {'label': 'Service Health', 'path': '/service-health', 'icon': Icons.circle},
    ]},
    {'name': 'Core Banking', 'icon': Icons.account_balance, 'items': <Map<String, dynamic>>[
      {'label': 'Account Opening', 'path': '/account-opening', 'icon': Icons.account_circle},
      {'label': 'Account Statements', 'path': '/account-statements', 'icon': Icons.account_circle},
      {'label': 'Accounting Rules', 'path': '/accounting-rules', 'icon': Icons.account_circle},
      {'label': 'Branch Operations', 'path': '/branch-operations', 'icon': Icons.store},
      {'label': 'Channel Management', 'path': '/channel-management', 'icon': Icons.wifi_channel},
      {'label': 'Chart Of Accounts', 'path': '/chart-of-accounts', 'icon': Icons.account_circle},
      {'label': 'Cif Management', 'path': '/cif-management', 'icon': Icons.circle},
      {'label': 'Customer 360', 'path': '/customer-360', 'icon': Icons.people},
      {'label': 'Customer Bills', 'path': '/customer-bills', 'icon': Icons.people},
      {'label': 'Customer Cards', 'path': '/customer-cards', 'icon': Icons.credit_card},
      {'label': 'Customer Engagement', 'path': '/customer-engagement', 'icon': Icons.people},
      {'label': 'Customer Feedback', 'path': '/customer-feedback', 'icon': Icons.people},
      {'label': 'Customer Insights', 'path': '/customer-insights', 'icon': Icons.people},
      {'label': 'Customer Loans', 'path': '/customer-loans', 'icon': Icons.monetization_on},
      {'label': 'Customer Notifications', 'path': '/customer-notifications', 'icon': Icons.people},
      {'label': 'Customer Onboarding', 'path': '/customer-onboarding', 'icon': Icons.people},
      {'label': 'Customer Qr', 'path': '/customer-qr', 'icon': Icons.people},
      {'label': 'Customer Savings', 'path': '/customer-savings', 'icon': Icons.people},
      {'label': 'Customer Segments', 'path': '/customer-segments', 'icon': Icons.people},
      {'label': 'Customer Settings', 'path': '/customer-settings', 'icon': Icons.people},
      {'label': 'Customer Statements', 'path': '/customer-statements', 'icon': Icons.people},
      {'label': 'Customer Transfers', 'path': '/customer-transfers', 'icon': Icons.swap_horiz},
      {'label': 'Customers', 'path': '/customers', 'icon': Icons.people},
      {'label': 'Dormancy Mgmt', 'path': '/dormancy-mgmt', 'icon': Icons.hotel},
      {'label': 'Fixed Deposits', 'path': '/fixed-deposits', 'icon': Icons.point_of_sale},
      {'label': 'Gl Accounts', 'path': '/gl-accounts', 'icon': Icons.account_circle},
      {'label': 'Identity Channels', 'path': '/identity-channels', 'icon': Icons.wifi_channel},
      {'label': 'Interest Accrual', 'path': '/interest-accrual', 'icon': Icons.percent},
      {'label': 'Interest Rate', 'path': '/interest-rate', 'icon': Icons.percent},
      {'label': 'Account Closure', 'path': '/account-closure', 'icon': Icons.account_circle},
      {'label': 'Dormancy Management', 'path': '/dormancy-management', 'icon': Icons.hotel},
      {'label': 'Interest Computation', 'path': '/interest-computation', 'icon': Icons.percent},
      {'label': 'Loan Accounts', 'path': '/loan-accounts', 'icon': Icons.account_circle},
      {'label': 'Partner Onboarding Admin', 'path': '/partner-onboarding-admin', 'icon': Icons.person_add},
      {'label': 'Partner Onboarding Portal', 'path': '/partner-onboarding-portal', 'icon': Icons.person_add},
      {'label': 'Safe Deposit', 'path': '/safe-deposit', 'icon': Icons.point_of_sale},
      {'label': 'Savings Products', 'path': '/savings-products', 'icon': Icons.inventory},
      {'label': 'Teller', 'path': '/teller', 'icon': Icons.circle},
      {'label': 'Virtual Accounts', 'path': '/virtual-accounts', 'icon': Icons.account_circle},
    ]},
    {'name': 'Payments & Transfers', 'icon': Icons.swap_horiz, 'items': <Map<String, dynamic>>[
      {'label': 'Batch Eod', 'path': '/batch-eod', 'icon': Icons.layers},
      {'label': 'Batch Processing', 'path': '/batch-processing', 'icon': Icons.layers},
      {'label': 'Bulk Payments', 'path': '/bulk-payments', 'icon': Icons.payment},
      {'label': 'Cheque Clearing', 'path': '/cheque-clearing', 'icon': Icons.receipt_long},
      {'label': 'Cheque Imaging', 'path': '/cheque-imaging', 'icon': Icons.receipt_long},
      {'label': 'Fx Positions', 'path': '/fx-positions', 'icon': Icons.currency_exchange},
      {'label': 'Infra Postgres', 'path': '/infra-postgres', 'icon': Icons.storage},
      {'label': 'Interbank Settlement', 'path': '/interbank-settlement', 'icon': Icons.circle},
      {'label': 'Mojaloop PISP', 'path': '/mojaloop-pisp', 'icon': Icons.circle},
      {'label': 'Mojaloop Admin Limits', 'path': '/mojaloop-admin-limits', 'icon': Icons.circle},
      {'label': 'Mojaloop Admin Participants', 'path': '/mojaloop-admin-participants', 'icon': Icons.circle},
      {'label': 'Mojaloop Callback Endpoints', 'path': '/mojaloop-callback-endpoints', 'icon': Icons.circle},
      {'label': 'Mojaloop Callbacks', 'path': '/mojaloop-callbacks', 'icon': Icons.circle},
      {'label': 'Mojaloop Corridors', 'path': '/mojaloop-corridors', 'icon': Icons.circle},
      {'label': 'Mojaloop Ilp Packets', 'path': '/mojaloop-ilp-packets', 'icon': Icons.circle},
      {'label': 'Mojaloop', 'path': '/mojaloop', 'icon': Icons.circle},
      {'label': 'Mojaloop Settlement Models', 'path': '/mojaloop-settlement-models', 'icon': Icons.circle},
      {'label': 'Mojaloop Settlement Windows', 'path': '/mojaloop-settlement-windows', 'icon': Icons.circle},
      {'label': 'Mojaloop Tb Bridge Configs', 'path': '/mojaloop-tb-bridge-configs', 'icon': Icons.tune},
      {'label': 'Mojaloop Tb Bridge Entries', 'path': '/mojaloop-tb-bridge-entries', 'icon': Icons.circle},
      {'label': 'Nibss Direct Debit', 'path': '/nibss-direct-debit', 'icon': Icons.circle},
      {'label': 'Payment Investigation', 'path': '/payment-investigation', 'icon': Icons.payment},
      {'label': 'Payment Transactions', 'path': '/payment-transactions', 'icon': Icons.payment},
      {'label': 'Payments Hub', 'path': '/payments-hub', 'icon': Icons.payment},
      {'label': 'Pos Terminal', 'path': '/pos-terminal', 'icon': Icons.point_of_sale},
      {'label': 'Qr Payments', 'path': '/qr-payments', 'icon': Icons.payment},
      {'label': 'Remittance', 'path': '/remittance', 'icon': Icons.circle},
      {'label': 'Salary Processing', 'path': '/salary-processing', 'icon': Icons.circle},
      {'label': 'Swift Messaging', 'path': '/swift-messaging', 'icon': Icons.send},
      {'label': 'Transfers', 'path': '/transfers', 'icon': Icons.swap_horiz},
      {'label': 'Utility Payments', 'path': '/utility-payments', 'icon': Icons.payment},
    ]},
    {'name': 'Cards & Digital', 'icon': Icons.credit_card, 'items': <Map<String, dynamic>>[
      {'label': 'Biometric Auth', 'path': '/biometric-auth', 'icon': Icons.fingerprint},
      {'label': 'Card Fraud Rules', 'path': '/card-fraud-rules', 'icon': Icons.credit_card},
      {'label': 'Card Management', 'path': '/card-management', 'icon': Icons.credit_card},
      {'label': 'Card Tokens', 'path': '/card-tokens', 'icon': Icons.credit_card},
      {'label': 'Cards', 'path': '/cards', 'icon': Icons.credit_card},
      {'label': 'Embedded Finance', 'path': '/embedded-finance', 'icon': Icons.circle},
      {'label': 'Enaira Cbdc', 'path': '/enaira-cbdc', 'icon': Icons.psychology},
      {'label': 'Open Banking', 'path': '/open-banking', 'icon': Icons.circle},
    ]},
    {'name': 'Lending & Credit', 'icon': Icons.monetization_on, 'items': <Map<String, dynamic>>[
      {'label': 'Collateral', 'path': '/collateral', 'icon': Icons.real_estate_agent},
      {'label': 'Collateral Valuation', 'path': '/collateral-valuation', 'icon': Icons.real_estate_agent},
      {'label': 'Credit Bureau', 'path': '/credit-bureau', 'icon': Icons.circle},
      {'label': 'Credit Facilities', 'path': '/credit-facilities', 'icon': Icons.circle},
      {'label': 'Credit Risk', 'path': '/credit-risk', 'icon': Icons.shield},
      {'label': 'Doc Collections', 'path': '/doc-collections', 'icon': Icons.circle},
      {'label': 'Education Loans', 'path': '/education-loans', 'icon': Icons.monetization_on},
      {'label': 'Interbank Lending', 'path': '/interbank-lending', 'icon': Icons.circle},
      {'label': 'Credit Scoring', 'path': '/credit-scoring', 'icon': Icons.circle},
      {'label': 'Debt Collection', 'path': '/debt-collection', 'icon': Icons.circle},
      {'label': 'Loan Calculator', 'path': '/loan-calculator', 'icon': Icons.monetization_on},
      {'label': 'Loan Origination', 'path': '/loan-origination', 'icon': Icons.monetization_on},
      {'label': 'Loan Products', 'path': '/loan-products', 'icon': Icons.monetization_on},
      {'label': 'Loans', 'path': '/loans', 'icon': Icons.monetization_on},
      {'label': 'Microfinance Engine', 'path': '/microfinance-engine', 'icon': Icons.circle},
      {'label': 'Microfinance', 'path': '/microfinance', 'icon': Icons.circle},
      {'label': 'Mortgage', 'path': '/mortgage', 'icon': Icons.house},
      {'label': 'Syndicated Loans', 'path': '/syndicated-loans', 'icon': Icons.monetization_on},
    ]},
    {'name': 'Treasury & Markets', 'icon': Icons.trending_up, 'items': <Map<String, dynamic>>[
      {'label': 'Etd Trading', 'path': '/etd-trading', 'icon': Icons.circle},
      {'label': 'Fx Dealing Room', 'path': '/fx-dealing-room', 'icon': Icons.currency_exchange},
      {'label': 'Fx Rates', 'path': '/fx-rates', 'icon': Icons.currency_exchange},
      {'label': 'Fx Revaluation', 'path': '/fx-revaluation', 'icon': Icons.currency_exchange},
      {'label': 'Money Market', 'path': '/money-market', 'icon': Icons.circle},
      {'label': 'Multi Currency Fx', 'path': '/multi-currency-fx', 'icon': Icons.currency_exchange},
      {'label': 'Portfolio Mgmt', 'path': '/portfolio-mgmt', 'icon': Icons.pie_chart},
      {'label': 'Treasury Investments', 'path': '/treasury-investments', 'icon': Icons.trending_up},
      {'label': 'Treasury Liquidity', 'path': '/treasury-liquidity', 'icon': Icons.trending_up},
      {'label': 'Treasury', 'path': '/treasury', 'icon': Icons.trending_up},
      {'label': 'Wakala Investment', 'path': '/wakala-investment', 'icon': Icons.show_chart},
      {'label': 'Wealth Mgmt', 'path': '/wealth-mgmt', 'icon': Icons.diamond},
    ]},
    {'name': 'Trade Finance', 'icon': Icons.local_shipping, 'items': <Map<String, dynamic>>[
      {'label': 'Bank Guarantees', 'path': '/bank-guarantees', 'icon': Icons.circle},
      {'label': 'Correspondent Banking', 'path': '/correspondent-banking', 'icon': Icons.circle},
      {'label': 'Escrow', 'path': '/escrow', 'icon': Icons.circle},
      {'label': 'Factoring', 'path': '/factoring', 'icon': Icons.circle},
      {'label': 'Lc Amendments', 'path': '/lc-amendments', 'icon': Icons.circle},
      {'label': 'Supply Chain Finance', 'path': '/supply-chain-finance', 'icon': Icons.psychology},
      {'label': 'Trade Finance', 'path': '/trade-finance', 'icon': Icons.local_shipping},
    ]},
    {'name': 'Accounting & GL', 'icon': Icons.calculate, 'items': <Map<String, dynamic>>[
      {'label': 'Eod Processor', 'path': '/eod-processor', 'icon': Icons.circle},
      {'label': 'Gl Engine', 'path': '/gl-engine', 'icon': Icons.calculate},
      {'label': 'Ifrs9 Engine', 'path': '/ifrs9-engine', 'icon': Icons.circle},
      {'label': 'Journal Entries', 'path': '/journal-entries', 'icon': Icons.menu_book},
      {'label': 'Ledger', 'path': '/ledger', 'icon': Icons.book},
      {'label': 'Ledger Sync', 'path': '/ledger-sync', 'icon': Icons.book},
      {'label': 'Reconciliation', 'path': '/reconciliation', 'icon': Icons.compare_arrows},
      {'label': 'Tb Pg Reconciliation Rules', 'path': '/tb-pg-reconciliation-rules', 'icon': Icons.compare_arrows},
      {'label': 'Tb Pg Reconciliation Runs', 'path': '/tb-pg-reconciliation-runs', 'icon': Icons.compare_arrows},
      {'label': 'Tenant Provisioning', 'path': '/tenant-provisioning', 'icon': Icons.domain},
      {'label': 'Tigerbeetle Ledger', 'path': '/tigerbeetle-ledger', 'icon': Icons.book},
    ]},
    {'name': 'Risk & Compliance', 'icon': Icons.shield, 'items': <Map<String, dynamic>>[
      {'label': 'Ai Fraud Detection', 'path': '/ai-fraud-detection', 'icon': Icons.warning},
      {'label': 'Basel Engine', 'path': '/basel-engine', 'icon': Icons.circle},
      {'label': 'Cbn Returns', 'path': '/cbn-returns', 'icon': Icons.circle},
      {'label': 'Compliance Checks', 'path': '/compliance-checks', 'icon': Icons.verified},
      {'label': 'Fatca Crs', 'path': '/fatca-crs', 'icon': Icons.circle},
      {'label': 'Fraud Detection', 'path': '/fraud-detection', 'icon': Icons.warning},
      {'label': 'Fraud Rules', 'path': '/fraud-rules', 'icon': Icons.warning},
      {'label': 'Kyb Engine', 'path': '/kyb-engine', 'icon': Icons.circle},
      {'label': 'Kyb Triggers', 'path': '/kyb-triggers', 'icon': Icons.circle},
      {'label': 'Kyc Aml', 'path': '/kyc-aml', 'icon': Icons.model_training},
      {'label': 'Kyc Engine', 'path': '/kyc-engine', 'icon': Icons.verified_user},
      {'label': 'Kyc Event Rules', 'path': '/kyc-event-rules', 'icon': Icons.verified_user},
      {'label': 'Kyc Overrides', 'path': '/kyc-overrides', 'icon': Icons.verified_user},
      {'label': 'Kyc Service Gates', 'path': '/kyc-service-gates', 'icon': Icons.verified_user},
      {'label': 'Kyc Triggers', 'path': '/kyc-triggers', 'icon': Icons.verified_user},
      {'label': 'Sanctions Screening', 'path': '/sanctions-screening', 'icon': Icons.block},
      {'label': 'Risk-Based Approach', 'path': '/risk-based-approach', 'icon': Icons.shield},
      {'label': 'PEP Enhanced DD', 'path': '/pep-enhanced-dd', 'icon': Icons.circle},
      {'label': 'Video KYC', 'path': '/video-kyc', 'icon': Icons.verified_user},
      {'label': 'KYC Workflow', 'path': '/kyc-workflow', 'icon': Icons.account_tree},
      {'label': 'KYC Self-Service', 'path': '/kyc-self-service', 'icon': Icons.verified_user},
      {'label': 'Agent KYC Capture', 'path': '/agent-kyc-capture', 'icon': Icons.support_agent},
      {'label': 'KYC Data Quality', 'path': '/kyc-data-quality', 'icon': Icons.data_usage},
      {'label': 'eFASS KYC Returns', 'path': '/efass-kyc-returns', 'icon': Icons.verified_user},
      {'label': 'KYC Enhanced Summary', 'path': '/kyc-enhanced-summary', 'icon': Icons.verified_user},
      {'label': 'GNN Fraud Detection', 'path': '/gnn-fraud-detection', 'icon': Icons.warning},
      {'label': 'FraudFusion Ensemble', 'path': '/fraudfusion-ensemble', 'icon': Icons.warning},
      {'label': 'MCMC Bayesian Risk', 'path': '/mcmc-bayesian-risk', 'icon': Icons.shield},
      {'label': 'Regulatory Sandbox', 'path': '/regulatory-sandbox', 'icon': Icons.circle},
      {'label': 'Pep Database', 'path': '/pep-database', 'icon': Icons.data_usage},
      {'label': 'Regulatory Automation', 'path': '/regulatory-automation', 'icon': Icons.circle},
      {'label': 'Regulatory Calendar', 'path': '/regulatory-calendar', 'icon': Icons.circle},
      {'label': 'Regulatory Reporting', 'path': '/regulatory-reporting', 'icon': Icons.assessment},
      {'label': 'Risk Scoring', 'path': '/risk-scoring', 'icon': Icons.shield},
      {'label': 'Watchlist', 'path': '/watchlist', 'icon': Icons.circle},
    ]},
    {'name': 'Insurance', 'icon': Icons.health_and_safety, 'items': <Map<String, dynamic>>[
      {'label': 'Agricultural Insurance', 'path': '/agricultural-insurance', 'icon': Icons.health_and_safety},
      {'label': 'Insurance', 'path': '/insurance', 'icon': Icons.health_and_safety},
    ]},
    {'name': 'Agent Banking', 'icon': Icons.people, 'items': <Map<String, dynamic>>[
      {'label': 'Agent Banking', 'path': '/agent-banking', 'icon': Icons.support_agent},
      {'label': 'Agent Performance', 'path': '/agent-performance', 'icon': Icons.support_agent},
      {'label': 'Ussd Banking', 'path': '/ussd-banking', 'icon': Icons.circle},
    ]},
    {'name': 'Billing & Revenue', 'icon': Icons.receipt_long, 'items': <Map<String, dynamic>>[
      {'label': 'Billing Engine', 'path': '/billing-engine', 'icon': Icons.receipt},
      {'label': 'Billing Event Processor', 'path': '/billing-event-processor', 'icon': Icons.receipt},
      {'label': 'Billing Orchestrator', 'path': '/billing-orchestrator', 'icon': Icons.receipt},
      {'label': 'Billing Rbac', 'path': '/billing-rbac', 'icon': Icons.receipt},
      {'label': 'Fee Schedules', 'path': '/fee-schedules', 'icon': Icons.attach_money},
      {'label': 'Fee Management', 'path': '/fee-management', 'icon': Icons.attach_money},
      {'label': 'Real-Time Pricing', 'path': '/realtime-pricing', 'icon': Icons.sell},
      {'label': 'Pricing Model', 'path': '/pricing-model', 'icon': Icons.sell},
      {'label': 'Relationship Pricing', 'path': '/relationship-pricing', 'icon': Icons.sell},
      {'label': 'Standing Charges', 'path': '/standing-charges', 'icon': Icons.circle},
    ]},
    {'name': 'Multi-Tenant Platform', 'icon': Icons.domain, 'items': <Map<String, dynamic>>[
      {'label': 'Custom Domain', 'path': '/custom-domain', 'icon': Icons.psychology},
      {'label': 'Lakehouse Domain Cdc', 'path': '/lakehouse-domain-cdc', 'icon': Icons.psychology},
      {'label': 'Tenant Isolation', 'path': '/tenant-isolation', 'icon': Icons.domain},
      {'label': 'Tenant Metering', 'path': '/tenant-metering', 'icon': Icons.domain},
      {'label': 'White Label Config', 'path': '/white-label-config', 'icon': Icons.tune},
      {'label': 'White Label Engine', 'path': '/white-label-engine', 'icon': Icons.circle},
    ]},
    {'name': 'AI / ML / GNN', 'icon': Icons.psychology, 'items': <Map<String, dynamic>>[
      {'label': 'Audit Trail', 'path': '/audit-trail', 'icon': Icons.fact_check},
      {'label': 'Chatbot', 'path': '/chatbot', 'icon': Icons.circle},
      {'label': 'Complaints', 'path': '/complaints', 'icon': Icons.psychology},
      {'label': 'Sms Email Gateway', 'path': '/sms-email-gateway', 'icon': Icons.router},
    ]},
    {'name': 'Infrastructure', 'icon': Icons.dns, 'items': <Map<String, dynamic>>[
      {'label': 'Apisix Plugins', 'path': '/apisix-plugins', 'icon': Icons.api},
      {'label': 'Apisix Routes', 'path': '/apisix-routes', 'icon': Icons.api},
      {'label': 'Apisix Upstreams', 'path': '/apisix-upstreams', 'icon': Icons.api},
      {'label': 'Dapr Sidecar', 'path': '/dapr-sidecar', 'icon': Icons.circle},
      {'label': 'Event Bus', 'path': '/event-bus', 'icon': Icons.circle},
      {'label': 'Event Streaming', 'path': '/event-streaming', 'icon': Icons.circle},
      {'label': 'Fluvio Streams', 'path': '/fluvio-streams', 'icon': Icons.circle},
      {'label': 'Infra Kafka', 'path': '/infra-kafka', 'icon': Icons.stream},
      {'label': 'Infra Opensearch', 'path': '/infra-opensearch', 'icon': Icons.search},
      {'label': 'Infra Redis', 'path': '/infra-redis', 'icon': Icons.memory},
      {'label': 'Infra Tigerbeetle', 'path': '/infra-tigerbeetle', 'icon': Icons.transform},
      {'label': 'Kafka Event Bus', 'path': '/kafka-event-bus', 'icon': Icons.stream},
      {'label': 'Kafka Streaming', 'path': '/kafka-streaming', 'icon': Icons.stream},
      {'label': 'Keycloak Clients', 'path': '/keycloak-clients', 'icon': Icons.circle},
      {'label': 'Keycloak Idps', 'path': '/keycloak-idps', 'icon': Icons.circle},
      {'label': 'Keycloak Realms', 'path': '/keycloak-realms', 'icon': Icons.circle},
      {'label': 'Keycloak Roles', 'path': '/keycloak-roles', 'icon': Icons.circle},
      {'label': 'Keycloak', 'path': '/keycloak', 'icon': Icons.circle},
      {'label': 'Kafka Governance', 'path': '/kafka-governance', 'icon': Icons.stream},
      {'label': 'Lakehouse Cdc Events', 'path': '/lakehouse-cdc-events', 'icon': Icons.warehouse},
      {'label': 'Openappsec Events', 'path': '/openappsec-events', 'icon': Icons.circle},
      {'label': 'Opensearch', 'path': '/opensearch', 'icon': Icons.search},
      {'label': 'Performance Cache', 'path': '/performance-cache', 'icon': Icons.circle},
      {'label': 'Permify', 'path': '/permify', 'icon': Icons.circle},
      {'label': 'Tb Pg Balance Cache Configs', 'path': '/tb-pg-balance-cache-configs', 'icon': Icons.tune},
      {'label': 'Tb Pg Balance Cache Entries', 'path': '/tb-pg-balance-cache-entries', 'icon': Icons.circle},
      {'label': 'Tb Pg Sync Events', 'path': '/tb-pg-sync-events', 'icon': Icons.circle},
    ]},
    {'name': 'Security', 'icon': Icons.lock, 'items': <Map<String, dynamic>>[
      {'label': 'Ddos Protection', 'path': '/ddos-protection', 'icon': Icons.shield},
      {'label': 'Jwt Auth', 'path': '/jwt-auth', 'icon': Icons.circle},
      {'label': 'Auth Enforcer', 'path': '/auth-enforcer', 'icon': Icons.circle},
      {'label': 'Accessibility Auditor', 'path': '/accessibility-auditor', 'icon': Icons.fact_check},
      {'label': 'Security Hardening', 'path': '/security-hardening', 'icon': Icons.security},
    ]},
    {'name': 'DevOps & Testing', 'icon': Icons.build, 'items': <Map<String, dynamic>>[
      {'label': 'E2E Tests', 'path': '/e2e-tests', 'icon': Icons.science},
      {'label': 'Etl Pipelines', 'path': '/etl-pipelines', 'icon': Icons.transform},
      {'label': 'Feature Flag Engine', 'path': '/feature-flag-engine', 'icon': Icons.circle},
      {'label': 'Integration Tests', 'path': '/integration-tests', 'icon': Icons.science},
      {'label': 'CocoIndex Pipelines', 'path': '/cocoindex-pipeline', 'icon': Icons.circle},
      {'label': 'Unit Tests', 'path': '/unit-test-runner', 'icon': Icons.science},
      {'label': 'Contract Tests', 'path': '/contract-tests', 'icon': Icons.science},
      {'label': 'Load Tests', 'path': '/load-test-runner', 'icon': Icons.science},
      {'label': 'Load Testing', 'path': '/load-testing', 'icon': Icons.science},
      {'label': 'Performance Metrics', 'path': '/performance-metrics', 'icon': Icons.circle},
      {'label': 'Stress Testing', 'path': '/stress-testing', 'icon': Icons.science},
    ]},
    {'name': 'Observability', 'icon': Icons.insights, 'items': <Map<String, dynamic>>[
      {'label': 'Error Catalog', 'path': '/error-catalog', 'icon': Icons.circle},
      {'label': 'Error Telemetry', 'path': '/error-telemetry', 'icon': Icons.circle},
      {'label': 'APM & Sentry', 'path': '/apm-sentry', 'icon': Icons.circle},
      {'label': 'Changelog Generator', 'path': '/changelog-generator', 'icon': Icons.circle},
      {'label': 'Product Catalog', 'path': '/product-catalog', 'icon': Icons.inventory},
      {'label': 'Prometheus Metrics', 'path': '/prometheus-metrics', 'icon': Icons.circle},
      {'label': 'Service Catalog', 'path': '/service-catalog', 'icon': Icons.circle},
    ]},
    {'name': 'Workflows & Operations', 'icon': Icons.account_tree, 'items': <Map<String, dynamic>>[
      {'label': 'Approval Workflow', 'path': '/approval-workflow', 'icon': Icons.account_tree},
      {'label': 'Document Management', 'path': '/document-management', 'icon': Icons.description},
      {'label': 'Notification Center', 'path': '/notification-center', 'icon': Icons.notifications_active},
      {'label': 'Notification Prefs', 'path': '/notification-prefs', 'icon': Icons.notifications_active},
      {'label': 'Notifications Engine', 'path': '/notifications-engine', 'icon': Icons.notifications_active},
      {'label': 'Notifications', 'path': '/notifications', 'icon': Icons.notifications_active},
      {'label': 'Workflow Definitions', 'path': '/workflow-definitions', 'icon': Icons.account_tree},
      {'label': 'Workflow Engine', 'path': '/workflow-engine', 'icon': Icons.account_tree},
      {'label': 'Workflow Instances', 'path': '/workflow-instances', 'icon': Icons.account_tree},
    ]},
    {'name': 'Data & Lakehouse', 'icon': Icons.storage, 'items': <Map<String, dynamic>>[
      {'label': 'Data Export', 'path': '/data-export', 'icon': Icons.data_usage},
      {'label': 'Database Persistence', 'path': '/database-persistence', 'icon': Icons.data_usage},
      {'label': 'Infra Lakehouse', 'path': '/infra-lakehouse', 'icon': Icons.warehouse},
      {'label': 'Tax Reporting', 'path': '/tax-reporting', 'icon': Icons.assessment},
      {'label': 'Lakehouse Clients', 'path': '/lakehouse-clients', 'icon': Icons.warehouse},
      {'label': 'Lakehouse Lineage Edges', 'path': '/lakehouse-lineage-edges', 'icon': Icons.warehouse},
      {'label': 'Lakehouse Lineage Nodes', 'path': '/lakehouse-lineage-nodes', 'icon': Icons.warehouse},
      {'label': 'Lakehouse Materialized Views', 'path': '/lakehouse-materialized-views', 'icon': Icons.warehouse},
      {'label': 'Lakehouse Query Federation', 'path': '/lakehouse-query-federation', 'icon': Icons.warehouse},
      {'label': 'Lakehouse', 'path': '/lakehouse', 'icon': Icons.warehouse},
      {'label': 'Report Generation', 'path': '/report-generation', 'icon': Icons.assessment},
      {'label': 'Reporting', 'path': '/reporting', 'icon': Icons.assessment},
      {'label': 'Sar Reports', 'path': '/sar-reports', 'icon': Icons.assessment},
    ]},
    {'name': 'Channels & Communications', 'icon': Icons.chat, 'items': <Map<String, dynamic>>[
      {'label': 'Branded Comms', 'path': '/branded-comms', 'icon': Icons.circle},
      {'label': 'Sms Banking', 'path': '/sms-banking', 'icon': Icons.sms},
    ]},
    {'name': 'Other', 'icon': Icons.more_horiz, 'items': <Map<String, dynamic>>[
      {'label': 'Api Marketplace', 'path': '/api-marketplace', 'icon': Icons.api},
      {'label': 'Atm Management', 'path': '/atm-management', 'icon': Icons.atm},
      {'label': 'Bandwidth Adaptation', 'path': '/bandwidth-adaptation', 'icon': Icons.circle},
      {'label': 'Beneficiary Mgmt', 'path': '/beneficiary-mgmt', 'icon': Icons.circle},
      {'label': 'Cash Management', 'path': '/cash-management', 'icon': Icons.circle},
      {'label': 'Cash Pooling', 'path': '/cash-pooling', 'icon': Icons.circle},
      {'label': 'Component Showcase', 'path': '/component-showcase', 'icon': Icons.circle},
      {'label': 'Contingent Liabilities', 'path': '/contingent-liabilities', 'icon': Icons.circle},
      {'label': 'Custody Service', 'path': '/custody-service', 'icon': Icons.circle},
      {'label': 'Db Admin', 'path': '/db-admin', 'icon': Icons.circle},
      {'label': 'Diaspora Banking', 'path': '/diaspora-banking', 'icon': Icons.circle},
      {'label': 'Disaster Recovery', 'path': '/disaster-recovery', 'icon': Icons.circle},
      {'label': 'Dispute Management', 'path': '/dispute-management', 'icon': Icons.circle},
      {'label': 'Erp Next', 'path': '/erp-next', 'icon': Icons.circle},
      {'label': 'Esg Banking', 'path': '/esg-banking', 'icon': Icons.circle},
      {'label': 'Esusu', 'path': '/esusu', 'icon': Icons.circle},
      {'label': 'Exam Management', 'path': '/exam-management', 'icon': Icons.circle},
      {'label': 'Expense Mgmt', 'path': '/expense-mgmt', 'icon': Icons.circle},
      {'label': 'Face Match', 'path': '/face-match', 'icon': Icons.circle},
      {'label': 'Fixed Assets', 'path': '/fixed-assets', 'icon': Icons.circle},
      {'label': 'Graduated Rollout', 'path': '/graduated-rollout', 'icon': Icons.circle},
      {'label': 'Ha Middleware', 'path': '/ha-middleware', 'icon': Icons.circle},
      {'label': 'Ha Services', 'path': '/ha-services', 'icon': Icons.circle},
      {'label': 'Ha Zones', 'path': '/ha-zones', 'icon': Icons.circle},
      {'label': 'Infra Temporal', 'path': '/infra-temporal', 'icon': Icons.circle},
      {'label': 'Inventory Finance', 'path': '/inventory-finance', 'icon': Icons.circle},
      {'label': 'Inventory', 'path': '/inventory', 'icon': Icons.circle},
      {'label': 'Islamic Banking', 'path': '/islamic-banking', 'icon': Icons.circle},
      {'label': 'Iso20022 Hub', 'path': '/iso20022-hub', 'icon': Icons.circle},
      {'label': 'Keda Autoscaling', 'path': '/keda-autoscaling', 'icon': Icons.circle},
      {'label': 'Keda Policies', 'path': '/keda-policies', 'icon': Icons.circle},
      {'label': 'BVN/NIN Verification', 'path': '/bvn-nin-verification', 'icon': Icons.circle},
      {'label': 'NFIU CTR/STR Filing', 'path': '/nfiu-ctr-str-filing', 'icon': Icons.circle},
      {'label': 'CAC Verification', 'path': '/cac-verification', 'icon': Icons.circle},
      {'label': 'UBO Ownership Graph', 'path': '/ubo-ownership-graph', 'icon': Icons.circle},
      {'label': 'Multi-Bureau Check', 'path': '/multi-bureau-check', 'icon': Icons.circle},
      {'label': 'Address Verification', 'path': '/address-verification', 'icon': Icons.circle},
      {'label': 'Corporate Doc Verify', 'path': '/corporate-doc-verify', 'icon': Icons.circle},
      {'label': 'Continuous Liveness', 'path': '/continuous-liveness', 'icon': Icons.circle},
      {'label': 'Adverse Media', 'path': '/adverse-media', 'icon': Icons.circle},
      {'label': 'EPR-KGQA Knowledge QA', 'path': '/epr-kgqa', 'icon': Icons.circle},
      {'label': 'FalkorDB Graph', 'path': '/falkordb-graph', 'icon': Icons.circle},
      {'label': 'Ollama Local LLM', 'path': '/ollama-llm', 'icon': Icons.circle},
      {'label': 'ART Adversarial Defense', 'path': '/art-adversarial', 'icon': Icons.circle},
      {'label': 'TB Multi-Currency', 'path': '/tb-multicurrency', 'icon': Icons.circle},
      {'label': 'CORS Gateway', 'path': '/cors-gateway', 'icon': Icons.router},
      {'label': 'Request Validator', 'path': '/request-validator', 'icon': Icons.circle},
      {'label': 'API Versioning', 'path': '/api-versioning', 'icon': Icons.api},
      {'label': 'Secrets Rotation', 'path': '/secrets-rotation', 'icon': Icons.circle},
      {'label': 'DB Migrations', 'path': '/db-migration-manager', 'icon': Icons.circle},
      {'label': 'Connection Pooler', 'path': '/connection-pooler', 'icon': Icons.circle},
      {'label': 'Backup Manager', 'path': '/backup-manager', 'icon': Icons.circle},
      {'label': 'E2E Orchestrator', 'path': '/e2e-orchestrator', 'icon': Icons.circle},
      {'label': 'OTel Collector', 'path': '/otel-collector', 'icon': Icons.circle},
      {'label': 'Helm Validator', 'path': '/helm-validator', 'icon': Icons.circle},
      {'label': 'i18n Localization', 'path': '/i18n-service', 'icon': Icons.circle},
      {'label': 'Developer Portal', 'path': '/developer-portal', 'icon': Icons.circle},
      {'label': 'Lcr Nsfr', 'path': '/lcr-nsfr', 'icon': Icons.circle},
      {'label': 'Leasing', 'path': '/leasing', 'icon': Icons.circle},
      {'label': 'Limit Management', 'path': '/limit-management', 'icon': Icons.circle},
      {'label': 'Liveness Detection', 'path': '/liveness-detection', 'icon': Icons.circle},
      {'label': 'Locker', 'path': '/locker', 'icon': Icons.circle},
      {'label': 'Maker Checker', 'path': '/maker-checker', 'icon': Icons.circle},
      {'label': 'Mandate Management', 'path': '/mandate-management', 'icon': Icons.circle},
      {'label': 'Messaging Gateway', 'path': '/messaging-gateway', 'icon': Icons.router},
      {'label': 'Multi Entity', 'path': '/multi-entity', 'icon': Icons.circle},
      {'label': 'Murabaha Calculator', 'path': '/murabaha-calculator', 'icon': Icons.circle},
      {'label': 'Offline Resilience', 'path': '/offline-resilience', 'icon': Icons.circle},
      {'label': 'Offline Transactions', 'path': '/offline-transactions', 'icon': Icons.circle},
      {'label': 'Openappsec Rules', 'path': '/openappsec-rules', 'icon': Icons.rule},
      {'label': 'Operations Center', 'path': '/operations-center', 'icon': Icons.circle},
      {'label': 'Otc Derivatives', 'path': '/otc-derivatives', 'icon': Icons.circle},
      {'label': 'Otel Configs', 'path': '/otel-configs', 'icon': Icons.tune},
      {'label': 'Pbac Engine', 'path': '/pbac-engine', 'icon': Icons.circle},
      {'label': 'Pension', 'path': '/pension', 'icon': Icons.circle},
      {'label': 'Pg Connection Pools', 'path': '/pg-connection-pools', 'icon': Icons.circle},
      {'label': 'Pg Index Advisory', 'path': '/pg-index-advisory', 'icon': Icons.circle},
      {'label': 'Pg Query Profiles', 'path': '/pg-query-profiles', 'icon': Icons.circle},
      {'label': 'Pg Slow Queries', 'path': '/pg-slow-queries', 'icon': Icons.circle},
      {'label': 'Pg Table Stats', 'path': '/pg-table-stats', 'icon': Icons.circle},
      {'label': 'Pg Tuning Params', 'path': '/pg-tuning-params', 'icon': Icons.circle},
      {'label': 'Plugin Marketplace', 'path': '/plugin-marketplace', 'icon': Icons.circle},
      {'label': 'Product Factory', 'path': '/product-factory', 'icon': Icons.inventory},
      {'label': 'Project Finance', 'path': '/project-finance', 'icon': Icons.circle},
      {'label': 'Proxy Routes', 'path': '/proxy-routes', 'icon': Icons.circle},
      {'label': 'Ransomware Protection', 'path': '/ransomware-protection', 'icon': Icons.circle},
      {'label': 'Rate Cascade', 'path': '/rate-cascade', 'icon': Icons.circle},
      {'label': 'Rate Limiting', 'path': '/rate-limiting', 'icon': Icons.circle},
      {'label': 'Retry Policies', 'path': '/retry-policies', 'icon': Icons.circle},
      {'label': 'Securities Trading', 'path': '/securities-trading', 'icon': Icons.circle},
      {'label': 'Seed Registry', 'path': '/seed-registry', 'icon': Icons.circle},
      {'label': 'Self Service Txns', 'path': '/self-service-txns', 'icon': Icons.circle},
      {'label': 'Service Registry', 'path': '/service-registry', 'icon': Icons.circle},
      {'label': 'Settings', 'path': '/settings', 'icon': Icons.settings},
      {'label': 'Signature Verification', 'path': '/signature-verification', 'icon': Icons.circle},
      {'label': 'Staff Management', 'path': '/staff-management', 'icon': Icons.circle},
      {'label': 'Standing Instructions', 'path': '/standing-instructions', 'icon': Icons.circle},
      {'label': 'Standing Orders', 'path': '/standing-orders', 'icon': Icons.circle},
      {'label': 'Statement Generator', 'path': '/statement-generator', 'icon': Icons.circle},
      {'label': 'Statement History', 'path': '/statement-history', 'icon': Icons.circle},
      {'label': 'Sukuk Management', 'path': '/sukuk-management', 'icon': Icons.circle},
      {'label': 'Takaful Management', 'path': '/takaful-management', 'icon': Icons.circle},
      {'label': 'Tb Pg Saga Definitions', 'path': '/tb-pg-saga-definitions', 'icon': Icons.circle},
      {'label': 'Tb Pg Saga Executions', 'path': '/tb-pg-saga-executions', 'icon': Icons.circle},
      {'label': 'Tb Pg Sync Configs', 'path': '/tb-pg-sync-configs', 'icon': Icons.tune},
      {'label': 'Temporal Sagas', 'path': '/temporal-sagas', 'icon': Icons.circle},
      {'label': 'Trust Estate', 'path': '/trust-estate', 'icon': Icons.circle},
      {'label': 'Webhook Deliveries', 'path': '/webhook-deliveries', 'icon': Icons.circle},
      {'label': 'Webhook Engine', 'path': '/webhook-engine', 'icon': Icons.circle},
      {'label': 'Webhook Subscriptions', 'path': '/webhook-subscriptions', 'icon': Icons.circle},
    ]},
  ];

  static final List<Map<String, dynamic>> _allNavItems = _navCategories.expand((cat) => cat['items'] as List<Map<String, dynamic>>).toList();


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('54Bank'), backgroundColor: Colors.green.shade800, foregroundColor: Colors.white),
      drawer: Drawer(
        child: Column(
          children: [
            DrawerHeader(
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [Colors.green.shade900, Colors.green.shade600]),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end, children: [
                const Text('54Bank', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                const Text('Core Banking Platform', style: TextStyle(color: Colors.white70, fontSize: 14)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                  child: Text('${_navCategories.length} categories · ${_allNavItems.length} pages', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search pages...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _searchQuery.isNotEmpty ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { setState(() { _searchController.clear(); _searchQuery = ''; }); }) : null,
                  filled: true,
                  fillColor: Colors.grey.shade100,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
              ),
            ),
            Expanded(
              child: _searchQuery.isNotEmpty
                ? ListView(
                    children: _allNavItems.where((item) => item['label'].toString().toLowerCase().contains(_searchQuery)).map((item) => ListTile(
                      leading: Icon(item['icon'] as IconData, size: 20, color: Colors.green.shade700),
                      title: Text(item['label'] as String, style: const TextStyle(fontSize: 14)),
                      dense: true,
                      onTap: () { Navigator.pop(context); Navigator.pushNamed(context, item['path'] as String); },
                    )).toList(),
                  )
                : ListView(
                    children: _navCategories.map((cat) => ExpansionTile(
                      leading: Icon(cat['icon'] as IconData, size: 20, color: Colors.green.shade800),
                      title: Text(cat['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(10)),
                        child: Text('${(cat["items"] as List).length}', style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
                      ),
                      children: (cat['items'] as List<Map<String, dynamic>>).map((item) => ListTile(
                        leading: Icon(item['icon'] as IconData, size: 18, color: Colors.green.shade600),
                        title: Text(item['label'] as String, style: const TextStyle(fontSize: 13)),
                        dense: true,
                        contentPadding: const EdgeInsets.only(left: 56),
                        onTap: () { Navigator.pop(context); Navigator.pushNamed(context, item['path'] as String); },
                      )).toList(),
                    )).toList(),
                  ),
            ),
          ],
        ),
      ),
      body: StreamBuilder<bool>(
        stream: ConnectivityService.instance.onlineStream,
        initialData: true,
        builder: (context, snapshot) {
          final isOnline = snapshot.data ?? true;
          return Column(children: [
            if (!isOnline) Container(width: double.infinity, color: Colors.orange, padding: const EdgeInsets.all(8), child: const Text('Offline — showing cached data', textAlign: TextAlign.center, style: TextStyle(color: Colors.white))),
            Expanded(child: GridView.count(
              crossAxisCount: 2,
              padding: const EdgeInsets.all(16),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              children: const [
                _DashboardCard(icon: Icons.account_balance, title: 'Accounts', subtitle: '2.8M active'),
                _DashboardCard(icon: Icons.swap_horiz, title: 'Transfers', subtitle: '45K today'),
                _DashboardCard(icon: Icons.credit_card, title: 'Cards', subtitle: '1.2M issued'),
                _DashboardCard(icon: Icons.attach_money, title: 'Loans', subtitle: '\u20A685B portfolio'),
                _DashboardCard(icon: Icons.security, title: 'KYC/AML', subtitle: '120 alerts'),
                _DashboardCard(icon: Icons.dashboard, title: 'Dashboard', subtitle: 'Real-time'),
              ],
            )),
          ]);
        },
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Colors.green.shade800,
        unselectedItemColor: Colors.grey.shade500,
        selectedFontSize: 11,
        unselectedFontSize: 10,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.swap_horiz), label: 'Transfers'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet), label: 'Accounts'),
          BottomNavigationBarItem(icon: Icon(Icons.credit_card), label: 'Cards'),
          BottomNavigationBarItem(icon: Icon(Icons.more_horiz), label: 'More'),
        ],
        currentIndex: 0,
        onTap: (index) {
          switch (index) {
            case 1: Navigator.pushNamed(context, '/transfers'); break;
            case 2: Navigator.pushNamed(context, '/account-opening'); break;
            case 3: Navigator.pushNamed(context, '/card-management'); break;
            case 4: Scaffold.of(context).openDrawer(); break;
          }
        },
      ),
    );
  }
}

class _DashboardCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _DashboardCard({required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Card(elevation: 2, child: Padding(padding: const EdgeInsets.all(16), child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 40, color: Colors.green.shade800),
        const SizedBox(height: 8),
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        Text(subtitle, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
      ],
    )));
  }
}
