/**
 * Drizzle ORM Routes — wires Express endpoints to real Postgres via drizzle-orm.
 *
 * Strategy: "DB-first, seed-fallback"
 *   1. Every GET/POST/PUT/DELETE tries the Drizzle repository first
 *   2. If DB is unavailable (no DATABASE_URL, connection refused), falls back to seed data
 *   3. Seed data is still the authoritative source when running locally without Postgres
 *
 * Uses the generic createRepository from postgresRepository.ts so every table
 * gets paginated list, getById, create, update, delete, count, search.
 */

import { eq, ilike, or, desc, asc, and, sql, count } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../db";
import { createRepository } from "./postgresRepository";
import { logger } from "./logger";
import {
  customers, accounts, transactions, journalEntries, glAccounts,
  loans, loanRepayments, transfers, settlements, amlAlerts,
  kycVerifications, fxTrades, nostroAccounts, auditTrail,
  swiftMessages, nipTransactions, cardTransactions, trialBalances,
  tenants, tenantFeatureFlags, customerCards, customerCardEvents,
  customerTransfers, customerStatements, customerNotifications,
  workflowCases, operatorActions, auditEntries, exportJobs,
  billingAccounts, billingInvoices, billingUsageEvents,
  farmers, agriLoans, cropInsurancePolicies, valueChainContracts,
  tellerSessions, tellerTransactions, vaultOperations,
  murabahaContracts, ijaraContracts, mudarabahContracts,
  lettersOfCredit, warehouseReceipts, bankGuarantees,
  mortgageApplications, educationLoans, esusuGroups,
  virtualAccounts, agentBankingAgents, lendingGroups,
  identityProfiles, disputeCases, reconciliationRuns,
  erpnextSyncJobs, regulatoryReports,
  escrowAccounts, escrowParties, escrowTransactions, escrowMilestones,
  escrowDisputes, escrowDocuments, escrowFees, escrowInterestAccruals,
  escrowRegulatoryReports, escrowAuditLog,
  scratchCards, cardBatches, pinVerifications, gridCards, cryptoKeys,
  mfaEnrollments, mfaPolicies, otpRecords, sessionRecords, apiKeys,
  securityEvents, certificates,
  jwtValidations, routeSchemas, sqlQueries, vaultSecrets, pinHashes, dockerHardeningChecks,
  pkceFlows, tokenFamilies, mtlsNodes, bodyLimitRules, kmsKeys, tlsConfigs,
  correlationRules, pciScans, apiKeyPolicies, pathValidationRules, keyRotationSchedules,
  networkPolicies, vaultEngines, anomalyModels, ndprRecords,
  outputEncodingRules, imageScans, wafRules, ddosRules, ipRules, siemPipelines, cbnComplianceChecks,
  egressPolicies, incidents, immutableAuditBlocks, soc2Evidence, pentestScans,
  sriHashes, cspPolicies, framePolicies, deviceProfiles,
  amlRiskScores, sarReports, ctrReports, amlCases, watchlistSources, adverseMediaScans,
  beneficialOwners, txnPatternAnalyses, goamlReports, amlComplianceMetrics, sanctionsBatchRuns,
  amlTrainingRecords, wireTransferMonitor, amlRegulatoryReports, typologyMatches,
  redisCacheEntries, redisSessions, cacheInvalidations, bloomFilters, sortedSetRankings, pgbouncerPools,
  queryCacheEntries, preparedStatements, tablePartitions, materializedViews, hotDataCaches, batchAggregatorConfigs,
  keepaliveConfigs, compressionConfigs, grpcServices, routeTrieStats, streamResponseConfigs, http2Connections,
  coalescingRules, fastJsonSchemas, swCacheStrategies, virtualScrollConfigs, memoizationTargets, bundleSplitConfigs,
  optimisticUIConfigs, kafkaConsumerGroups, kafkaBatchProducers, avroSchemas, fluvioSmartModules, eventDedupConfigs,
  distrolessImages, tbBatchConfigs, hpaConfigs, cdnEdgeConfigs, readReplicaConfigs, kedaScaleTriggers,
  prometheusDashboards, opensearchIndexConfigs, temporalMemoizedActivities, apisixPluginChains,
  // --- Added 96 missing table imports ---
  acgsfGuarantee,
  adverseMediaHits,
  agentFarmerOnboarding,
  agentKycCaptures,
  aggregationCenter,
  agriEsgImpact,
  agriEvoucher,
  agriInputMarketplace,
  agriIotSensor,
  agriLogistics,
  agriReinsurance,
  agriSavingsCycles,
  animalIdTraceability,
  areaYieldIndexInsurance,
  billingAccrualSnapshots,
  billingContractOverrides,
  billingDiscountRules,
  billingInvoiceApprovals,
  billingInvoiceLines,
  billingRateCardLines,
  billingRateCards,
  billingRatedEvents,
  billingRevenueShareRules,
  bureauChecks,
  cbnAgriReturns,
  cbnAgsmeis,
  cbnAnchorBorrowers,
  commodityExchange,
  commodityPriceIntelligence,
  cooperativeCreditScoring,
  cooperativeFinancials,
  cooperativeManagement,
  cooperativeMeetings,
  corporateMonitoringEvents,
  cropYieldPrediction,
  crossborderAgriTrade,
  customerApprovals,
  customerBillPayments,
  customerSavedBillers,
  customerSessionPreferences,
  customerStatementExports,
  efassReturns,
  equipmentLeasing,
  farmBoundaryMapping,
  fisheriesAquaculture,
  insurancePortfolioAnalytics,
  interactiveUssdAgri,
  kycDataQualityMetrics,
  kycTierHistory,
  kycTiers,
  livestockFinance,
  livestockInsurance,
  livestockManagement,
  multiPerilCropInsurance,
  nfiuFilings,
  nirsalAgroGeocoop,
  nirsalCreditGuarantee,
  parametricInsuranceIot,
  partnerApprovalRecords,
  partnerOnboardingRecords,
  postHarvestLossTracker,
  qualityCertification,
  riskScores,
  sanctionsScreenings,
  satelliteCropMonitor,
  smsAlertNotification,
  smsBankingGateway,
  smsOtpService,
  soilAnalysis,
  telegramBankingCommands,
  telegramBotGateway,
  telegramKycBot,
  telegramMiniApp,
  telegramNotification,
  transactionAlerts,
  transactionMonitoringRules,
  uboGraphEdges,
  uboGraphNodes,
  ussdBankingGateway,
  ussdMultilingual,
  ussdSimToolkit,
  ussdTransactionEngine,
  voiceAgentEscalation,
  voiceAsrNigerian,
  voiceBankingGateway,
  voiceBiometricAuth,
  voiceCallAnalytics,
  voiceIvrMenu,
  voiceNluBanking,
  voiceTtsNigerian,
  warehouseManagement,
  whatsappBankingFlows,
  whatsappBusinessGateway,
  whatsappDocumentService,
  whatsappNotification,
  whatsappPaymentIntegration,
} from "../../drizzle/schema";

// ── Repository Instances ──

const repos = {
  customers: createRepository(customers, customers.customerId, { tableName: "customers" }),
  accounts: createRepository(accounts, accounts.accountId, { tableName: "accounts" }),
  transactions: createRepository(transactions, transactions.transactionId, { tableName: "transactions" }),
  journalEntries: createRepository(journalEntries, journalEntries.entryId, { tableName: "journalEntries" }),
  glAccounts: createRepository(glAccounts, glAccounts.glAccountCode, { tableName: "glAccounts" }),
  loans: createRepository(loans, loans.loanId, { tableName: "loans" }),
  loanRepayments: createRepository(loanRepayments, loanRepayments.repaymentId, { tableName: "loanRepayments" }),
  transfers: createRepository(transfers, transfers.transferId, { tableName: "transfers" }),
  settlements: createRepository(settlements, settlements.settlementId, { tableName: "settlements" }),
  amlAlerts: createRepository(amlAlerts, amlAlerts.alertId, { tableName: "amlAlerts" }),
  kycVerifications: createRepository(kycVerifications, kycVerifications.verificationId, { tableName: "kycVerifications" }),
  fxTrades: createRepository(fxTrades, fxTrades.tradeId, { tableName: "fxTrades" }),
  nostroAccounts: createRepository(nostroAccounts, nostroAccounts.nostroId, { tableName: "nostroAccounts" }),
  auditTrail: createRepository(auditTrail, auditTrail.auditId, { tableName: "auditTrail" }),
  swiftMessages: createRepository(swiftMessages, swiftMessages.messageId, { tableName: "swiftMessages" }),
  nipTransactions: createRepository(nipTransactions, nipTransactions.nipId, { tableName: "nipTransactions" }),
  cardTransactions: createRepository(cardTransactions, cardTransactions.cardTxnId, { tableName: "cardTransactions" }),
  trialBalances: createRepository(trialBalances, trialBalances.trialBalanceId, { tableName: "trialBalances" }),
  tenants: createRepository(tenants, tenants.tenantId, { tableName: "tenants" }),
  tenantFeatureFlags: createRepository(tenantFeatureFlags, tenantFeatureFlags.featureKey, { tableName: "tenantFeatureFlags" }),
  customerCards: createRepository(customerCards, customerCards.cardId, { tableName: "customerCards" }),
  customerTransfers: createRepository(customerTransfers, customerTransfers.id, { tableName: "customerTransfers" }),
  customerStatements: createRepository(customerStatements, customerStatements.id, { tableName: "customerStatements" }),
  customerNotifications: createRepository(customerNotifications, customerNotifications.id, { tableName: "customerNotifications" }),
  workflowCases: createRepository(workflowCases, workflowCases.id, { tableName: "workflowCases" }),
  operatorActions: createRepository(operatorActions, operatorActions.id, { tableName: "operatorActions" }),
  auditEntries: createRepository(auditEntries, auditEntries.id, { tableName: "auditEntries" }),
  exportJobs: createRepository(exportJobs, exportJobs.id, { tableName: "exportJobs" }),
  billingAccounts: createRepository(billingAccounts, billingAccounts.id, { tableName: "billingAccounts" }),
  billingInvoices: createRepository(billingInvoices, billingInvoices.id, { tableName: "billingInvoices" }),
  billingUsageEvents: createRepository(billingUsageEvents, billingUsageEvents.id, { tableName: "billingUsageEvents" }),
  farmers: createRepository(farmers, farmers.id, { tableName: "farmers" }),
  agriLoans: createRepository(agriLoans, agriLoans.id, { tableName: "agriLoans" }),
  cropInsurancePolicies: createRepository(cropInsurancePolicies, cropInsurancePolicies.id, { tableName: "cropInsurancePolicies" }),
  valueChainContracts: createRepository(valueChainContracts, valueChainContracts.id, { tableName: "valueChainContracts" }),
  tellerSessions: createRepository(tellerSessions, tellerSessions.id, { tableName: "tellerSessions" }),
  tellerTransactions: createRepository(tellerTransactions, tellerTransactions.id, { tableName: "tellerTransactions" }),
  vaultOperations: createRepository(vaultOperations, vaultOperations.id, { tableName: "vaultOperations" }),
  murabahaContracts: createRepository(murabahaContracts, murabahaContracts.id, { tableName: "murabahaContracts" }),
  ijaraContracts: createRepository(ijaraContracts, ijaraContracts.id, { tableName: "ijaraContracts" }),
  mudarabahContracts: createRepository(mudarabahContracts, mudarabahContracts.id, { tableName: "mudarabahContracts" }),
  lettersOfCredit: createRepository(lettersOfCredit, lettersOfCredit.id, { tableName: "lettersOfCredit" }),
  warehouseReceipts: createRepository(warehouseReceipts, warehouseReceipts.id, { tableName: "warehouseReceipts" }),
  bankGuarantees: createRepository(bankGuarantees, bankGuarantees.id, { tableName: "bankGuarantees" }),
  mortgageApplications: createRepository(mortgageApplications, mortgageApplications.id, { tableName: "mortgageApplications" }),
  educationLoans: createRepository(educationLoans, educationLoans.id, { tableName: "educationLoans" }),
  esusuGroups: createRepository(esusuGroups, esusuGroups.id, { tableName: "esusuGroups" }),
  virtualAccounts: createRepository(virtualAccounts, virtualAccounts.id, { tableName: "virtualAccounts" }),
  agentBankingAgents: createRepository(agentBankingAgents, agentBankingAgents.id, { tableName: "agentBankingAgents" }),
  lendingGroups: createRepository(lendingGroups, lendingGroups.id, { tableName: "lendingGroups" }),
  identityProfiles: createRepository(identityProfiles, identityProfiles.id, { tableName: "identityProfiles" }),
  disputeCases: createRepository(disputeCases, disputeCases.id, { tableName: "disputeCases" }),
  reconciliationRuns: createRepository(reconciliationRuns, reconciliationRuns.id, { tableName: "reconciliationRuns" }),
  erpnextSyncJobs: createRepository(erpnextSyncJobs, erpnextSyncJobs.id, { tableName: "erpnextSyncJobs" }),
  regulatoryReports: createRepository(regulatoryReports, regulatoryReports.id, { tableName: "regulatoryReports" }),
  // Escrow
  escrowAccounts: createRepository(escrowAccounts, escrowAccounts.escrowId, { tableName: "escrowAccounts" }),
  escrowParties: createRepository(escrowParties, escrowParties.id, { tableName: "escrowParties" }),
  escrowTransactions: createRepository(escrowTransactions, escrowTransactions.txId, { tableName: "escrowTransactions" }),
  escrowMilestones: createRepository(escrowMilestones, escrowMilestones.milestoneId, { tableName: "escrowMilestones" }),
  escrowDisputes: createRepository(escrowDisputes, escrowDisputes.disputeId, { tableName: "escrowDisputes" }),
  escrowDocuments: createRepository(escrowDocuments, escrowDocuments.documentId, { tableName: "escrowDocuments" }),
  escrowFees: createRepository(escrowFees, escrowFees.feeId, { tableName: "escrowFees" }),
  escrowInterestAccruals: createRepository(escrowInterestAccruals, escrowInterestAccruals.accrualId, { tableName: "escrowInterestAccruals" }),
  escrowRegulatoryReports: createRepository(escrowRegulatoryReports, escrowRegulatoryReports.reportId, { tableName: "escrowRegulatoryReports" }),
  escrowAuditLog: createRepository(escrowAuditLog, escrowAuditLog.auditId, { tableName: "escrowAuditLog" }),
  // Security
  scratchCards: createRepository(scratchCards, scratchCards.id, { tableName: "scratchCards" }),
  cardBatches: createRepository(cardBatches, cardBatches.id, { tableName: "cardBatches" }),
  pinVerifications: createRepository(pinVerifications, pinVerifications.id, { tableName: "pinVerifications" }),
  gridCards: createRepository(gridCards, gridCards.id, { tableName: "gridCards" }),
  cryptoKeys: createRepository(cryptoKeys, cryptoKeys.id, { tableName: "cryptoKeys" }),
  mfaEnrollments: createRepository(mfaEnrollments, mfaEnrollments.id, { tableName: "mfaEnrollments" }),
  mfaPolicies: createRepository(mfaPolicies, mfaPolicies.id, { tableName: "mfaPolicies" }),
  otpRecords: createRepository(otpRecords, otpRecords.id, { tableName: "otpRecords" }),
  sessionRecords: createRepository(sessionRecords, sessionRecords.id, { tableName: "sessionRecords" }),
  apiKeys: createRepository(apiKeys, apiKeys.id, { tableName: "apiKeys" }),
  securityEvents: createRepository(securityEvents, securityEvents.id, { tableName: "securityEvents" }),
  certificates: createRepository(certificates, certificates.id, { tableName: "certificates" }),
  // Platform Security Hardening
  jwtValidations: createRepository(jwtValidations, jwtValidations.id, { tableName: "jwtValidations" }),
  routeSchemas: createRepository(routeSchemas, routeSchemas.id, { tableName: "routeSchemas" }),
  sqlQueries: createRepository(sqlQueries, sqlQueries.id, { tableName: "sqlQueries" }),
  vaultSecrets: createRepository(vaultSecrets, vaultSecrets.id, { tableName: "vaultSecrets" }),
  pinHashes: createRepository(pinHashes, pinHashes.id, { tableName: "pinHashes" }),
  dockerHardeningChecks: createRepository(dockerHardeningChecks, dockerHardeningChecks.id, { tableName: "dockerHardeningChecks" }),
  pkceFlows: createRepository(pkceFlows, pkceFlows.id, { tableName: "pkceFlows" }),
  tokenFamilies: createRepository(tokenFamilies, tokenFamilies.id, { tableName: "tokenFamilies" }),
  mtlsNodes: createRepository(mtlsNodes, mtlsNodes.id, { tableName: "mtlsNodes" }),
  bodyLimitRules: createRepository(bodyLimitRules, bodyLimitRules.id, { tableName: "bodyLimitRules" }),
  kmsKeys: createRepository(kmsKeys, kmsKeys.id, { tableName: "kmsKeys" }),
  tlsConfigs: createRepository(tlsConfigs, tlsConfigs.id, { tableName: "tlsConfigs" }),
  correlationRules: createRepository(correlationRules, correlationRules.id, { tableName: "correlationRules" }),
  pciScans: createRepository(pciScans, pciScans.id, { tableName: "pciScans" }),
  apiKeyPolicies: createRepository(apiKeyPolicies, apiKeyPolicies.id, { tableName: "apiKeyPolicies" }),
  pathValidationRules: createRepository(pathValidationRules, pathValidationRules.id, { tableName: "pathValidationRules" }),
  keyRotationSchedules: createRepository(keyRotationSchedules, keyRotationSchedules.id, { tableName: "keyRotationSchedules" }),
  networkPolicies: createRepository(networkPolicies, networkPolicies.id, { tableName: "networkPolicies" }),
  vaultEngines: createRepository(vaultEngines, vaultEngines.id, { tableName: "vaultEngines" }),
  anomalyModels: createRepository(anomalyModels, anomalyModels.id, { tableName: "anomalyModels" }),
  ndprRecords: createRepository(ndprRecords, ndprRecords.id, { tableName: "ndprRecords" }),
  outputEncodingRules: createRepository(outputEncodingRules, outputEncodingRules.id, { tableName: "outputEncodingRules" }),
  imageScans: createRepository(imageScans, imageScans.id, { tableName: "imageScans" }),
  wafRules: createRepository(wafRules, wafRules.id, { tableName: "wafRules" }),
  ddosRules: createRepository(ddosRules, ddosRules.id, { tableName: "ddosRules" }),
  ipRules: createRepository(ipRules, ipRules.id, { tableName: "ipRules" }),
  siemPipelines: createRepository(siemPipelines, siemPipelines.id, { tableName: "siemPipelines" }),
  cbnComplianceChecks: createRepository(cbnComplianceChecks, cbnComplianceChecks.id, { tableName: "cbnComplianceChecks" }),
  egressPolicies: createRepository(egressPolicies, egressPolicies.id, { tableName: "egressPolicies" }),
  incidents: createRepository(incidents, incidents.id, { tableName: "incidents" }),
  immutableAuditBlocks: createRepository(immutableAuditBlocks, immutableAuditBlocks.id, { tableName: "immutableAuditBlocks" }),
  soc2Evidence: createRepository(soc2Evidence, soc2Evidence.id, { tableName: "soc2Evidence" }),
  pentestScans: createRepository(pentestScans, pentestScans.id, { tableName: "pentestScans" }),
  sriHashes: createRepository(sriHashes, sriHashes.id, { tableName: "sriHashes" }),
  cspPolicies: createRepository(cspPolicies, cspPolicies.id, { tableName: "cspPolicies" }),
  framePolicies: createRepository(framePolicies, framePolicies.id, { tableName: "framePolicies" }),
  deviceProfiles: createRepository(deviceProfiles, deviceProfiles.id, { tableName: "deviceProfiles" }),
  amlRiskScores: createRepository(amlRiskScores, amlRiskScores.id, { tableName: "amlRiskScores" }),
  sarReports: createRepository(sarReports, sarReports.id, { tableName: "sarReports" }),
  ctrReports: createRepository(ctrReports, ctrReports.id, { tableName: "ctrReports" }),
  amlCases: createRepository(amlCases, amlCases.id, { tableName: "amlCases" }),
  watchlistSources: createRepository(watchlistSources, watchlistSources.id, { tableName: "watchlistSources" }),
  adverseMediaScans: createRepository(adverseMediaScans, adverseMediaScans.id, { tableName: "adverseMediaScans" }),
  beneficialOwners: createRepository(beneficialOwners, beneficialOwners.id, { tableName: "beneficialOwners" }),
  txnPatternAnalyses: createRepository(txnPatternAnalyses, txnPatternAnalyses.id, { tableName: "txnPatternAnalyses" }),
  goamlReports: createRepository(goamlReports, goamlReports.id, { tableName: "goamlReports" }),
  amlComplianceMetrics: createRepository(amlComplianceMetrics, amlComplianceMetrics.id, { tableName: "amlComplianceMetrics" }),
  sanctionsBatchRuns: createRepository(sanctionsBatchRuns, sanctionsBatchRuns.id, { tableName: "sanctionsBatchRuns" }),
  amlTrainingRecords: createRepository(amlTrainingRecords, amlTrainingRecords.id, { tableName: "amlTrainingRecords" }),
  wireTransferMonitor: createRepository(wireTransferMonitor, wireTransferMonitor.id, { tableName: "wireTransferMonitor" }),
  amlRegulatoryReports: createRepository(amlRegulatoryReports, amlRegulatoryReports.id, { tableName: "amlRegulatoryReports" }),
  typologyMatches: createRepository(typologyMatches, typologyMatches.id, { tableName: "typologyMatches" }),
  redisCacheEntries: createRepository(redisCacheEntries, redisCacheEntries.id, { tableName: "redisCacheEntries" }),
  redisSessions: createRepository(redisSessions, redisSessions.id, { tableName: "redisSessions" }),
  cacheInvalidations: createRepository(cacheInvalidations, cacheInvalidations.id, { tableName: "cacheInvalidations" }),
  bloomFilters: createRepository(bloomFilters, bloomFilters.id, { tableName: "bloomFilters" }),
  sortedSetRankings: createRepository(sortedSetRankings, sortedSetRankings.id, { tableName: "sortedSetRankings" }),
  pgbouncerPools: createRepository(pgbouncerPools, pgbouncerPools.id, { tableName: "pgbouncerPools" }),
  queryCacheEntries: createRepository(queryCacheEntries, queryCacheEntries.id, { tableName: "queryCacheEntries" }),
  preparedStatements: createRepository(preparedStatements, preparedStatements.id, { tableName: "preparedStatements" }),
  tablePartitions: createRepository(tablePartitions, tablePartitions.id, { tableName: "tablePartitions" }),
  materializedViews: createRepository(materializedViews, materializedViews.id, { tableName: "materializedViews" }),
  hotDataCaches: createRepository(hotDataCaches, hotDataCaches.id, { tableName: "hotDataCaches" }),
  batchAggregatorConfigs: createRepository(batchAggregatorConfigs, batchAggregatorConfigs.id, { tableName: "batchAggregatorConfigs" }),
  keepaliveConfigs: createRepository(keepaliveConfigs, keepaliveConfigs.id, { tableName: "keepaliveConfigs" }),
  compressionConfigs: createRepository(compressionConfigs, compressionConfigs.id, { tableName: "compressionConfigs" }),
  grpcServices: createRepository(grpcServices, grpcServices.id, { tableName: "grpcServices" }),
  routeTrieStats: createRepository(routeTrieStats, routeTrieStats.id, { tableName: "routeTrieStats" }),
  streamResponseConfigs: createRepository(streamResponseConfigs, streamResponseConfigs.id, { tableName: "streamResponseConfigs" }),
  http2Connections: createRepository(http2Connections, http2Connections.id, { tableName: "http2Connections" }),
  coalescingRules: createRepository(coalescingRules, coalescingRules.id, { tableName: "coalescingRules" }),
  fastJsonSchemas: createRepository(fastJsonSchemas, fastJsonSchemas.id, { tableName: "fastJsonSchemas" }),
  swCacheStrategies: createRepository(swCacheStrategies, swCacheStrategies.id, { tableName: "swCacheStrategies" }),
  virtualScrollConfigs: createRepository(virtualScrollConfigs, virtualScrollConfigs.id, { tableName: "virtualScrollConfigs" }),
  memoizationTargets: createRepository(memoizationTargets, memoizationTargets.id, { tableName: "memoizationTargets" }),
  bundleSplitConfigs: createRepository(bundleSplitConfigs, bundleSplitConfigs.id, { tableName: "bundleSplitConfigs" }),
  optimisticUIConfigs: createRepository(optimisticUIConfigs, optimisticUIConfigs.id, { tableName: "optimisticUIConfigs" }),
  kafkaConsumerGroups: createRepository(kafkaConsumerGroups, kafkaConsumerGroups.id, { tableName: "kafkaConsumerGroups" }),
  kafkaBatchProducers: createRepository(kafkaBatchProducers, kafkaBatchProducers.id, { tableName: "kafkaBatchProducers" }),
  avroSchemas: createRepository(avroSchemas, avroSchemas.id, { tableName: "avroSchemas" }),
  fluvioSmartModules: createRepository(fluvioSmartModules, fluvioSmartModules.id, { tableName: "fluvioSmartModules" }),
  eventDedupConfigs: createRepository(eventDedupConfigs, eventDedupConfigs.id, { tableName: "eventDedupConfigs" }),
  distrolessImages: createRepository(distrolessImages, distrolessImages.id, { tableName: "distrolessImages" }),
  tbBatchConfigs: createRepository(tbBatchConfigs, tbBatchConfigs.id, { tableName: "tbBatchConfigs" }),
  hpaConfigs: createRepository(hpaConfigs, hpaConfigs.id, { tableName: "hpaConfigs" }),
  cdnEdgeConfigs: createRepository(cdnEdgeConfigs, cdnEdgeConfigs.id, { tableName: "cdnEdgeConfigs" }),
  readReplicaConfigs: createRepository(readReplicaConfigs, readReplicaConfigs.id, { tableName: "readReplicaConfigs" }),
  kedaScaleTriggers: createRepository(kedaScaleTriggers, kedaScaleTriggers.id, { tableName: "kedaScaleTriggers" }),
  prometheusDashboards: createRepository(prometheusDashboards, prometheusDashboards.id, { tableName: "prometheusDashboards" }),
  opensearchIndexConfigs: createRepository(opensearchIndexConfigs, opensearchIndexConfigs.id, { tableName: "opensearchIndexConfigs" }),
  temporalMemoizedActivities: createRepository(temporalMemoizedActivities, temporalMemoizedActivities.id, { tableName: "temporalMemoizedActivities" }),
  apisixPluginChains: createRepository(apisixPluginChains, apisixPluginChains.id, { tableName: "apisixPluginChains" }),
  // --- Added 97 missing table repositories ---
  acgsfGuarantee: createRepository(acgsfGuarantee, acgsfGuarantee.id, { tableName: "acgsf_guarantee" }),
  adverseMediaHits: createRepository(adverseMediaHits, adverseMediaHits.id, { tableName: "adverse_media_hits" }),
  agentFarmerOnboarding: createRepository(agentFarmerOnboarding, agentFarmerOnboarding.id, { tableName: "agent_farmer_onboarding" }),
  agentKycCaptures: createRepository(agentKycCaptures, agentKycCaptures.id, { tableName: "agent_kyc_captures" }),
  aggregationCenter: createRepository(aggregationCenter, aggregationCenter.id, { tableName: "aggregation_center" }),
  agriEsgImpact: createRepository(agriEsgImpact, agriEsgImpact.id, { tableName: "agri_esg_impact" }),
  agriEvoucher: createRepository(agriEvoucher, agriEvoucher.id, { tableName: "agri_evoucher" }),
  agriInputMarketplace: createRepository(agriInputMarketplace, agriInputMarketplace.id, { tableName: "agri_input_marketplace" }),
  agriIotSensor: createRepository(agriIotSensor, agriIotSensor.id, { tableName: "agri_iot_sensor" }),
  agriLogistics: createRepository(agriLogistics, agriLogistics.id, { tableName: "agri_logistics" }),
  agriReinsurance: createRepository(agriReinsurance, agriReinsurance.id, { tableName: "agri_reinsurance" }),
  agriSavingsCycles: createRepository(agriSavingsCycles, agriSavingsCycles.id, { tableName: "agri_savings_cycles" }),
  animalIdTraceability: createRepository(animalIdTraceability, animalIdTraceability.id, { tableName: "animal_id_traceability" }),
  areaYieldIndexInsurance: createRepository(areaYieldIndexInsurance, areaYieldIndexInsurance.id, { tableName: "area_yield_index_insurance" }),
  billingAccrualSnapshots: createRepository(billingAccrualSnapshots, billingAccrualSnapshots.id, { tableName: "billingAccrualSnapshots" }),
  billingContractOverrides: createRepository(billingContractOverrides, billingContractOverrides.id, { tableName: "billingContractOverrides" }),
  billingDiscountRules: createRepository(billingDiscountRules, billingDiscountRules.id, { tableName: "billingDiscountRules" }),
  billingInvoiceApprovals: createRepository(billingInvoiceApprovals, billingInvoiceApprovals.id, { tableName: "billingInvoiceApprovals" }),
  billingInvoiceLines: createRepository(billingInvoiceLines, billingInvoiceLines.id, { tableName: "billingInvoiceLines" }),
  billingRateCardLines: createRepository(billingRateCardLines, billingRateCardLines.id, { tableName: "billingRateCardLines" }),
  billingRateCards: createRepository(billingRateCards, billingRateCards.id, { tableName: "billingRateCards" }),
  billingRatedEvents: createRepository(billingRatedEvents, billingRatedEvents.id, { tableName: "billingRatedEvents" }),
  billingRevenueShareRules: createRepository(billingRevenueShareRules, billingRevenueShareRules.id, { tableName: "billingRevenueShareRules" }),
  bureauChecks: createRepository(bureauChecks, bureauChecks.id, { tableName: "bureau_checks" }),
  cbnAgriReturns: createRepository(cbnAgriReturns, cbnAgriReturns.id, { tableName: "cbn_agri_returns" }),
  cbnAgsmeis: createRepository(cbnAgsmeis, cbnAgsmeis.id, { tableName: "cbn_agsmeis" }),
  cbnAnchorBorrowers: createRepository(cbnAnchorBorrowers, cbnAnchorBorrowers.id, { tableName: "cbn_anchor_borrowers" }),
  commodityExchange: createRepository(commodityExchange, commodityExchange.id, { tableName: "commodity_exchange" }),
  commodityPriceIntelligence: createRepository(commodityPriceIntelligence, commodityPriceIntelligence.id, { tableName: "commodity_price_intelligence" }),
  cooperativeCreditScoring: createRepository(cooperativeCreditScoring, cooperativeCreditScoring.id, { tableName: "cooperative_credit_scoring" }),
  cooperativeFinancials: createRepository(cooperativeFinancials, cooperativeFinancials.id, { tableName: "cooperative_financials" }),
  cooperativeManagement: createRepository(cooperativeManagement, cooperativeManagement.id, { tableName: "cooperative_management" }),
  cooperativeMeetings: createRepository(cooperativeMeetings, cooperativeMeetings.id, { tableName: "cooperative_meetings" }),
  corporateMonitoringEvents: createRepository(corporateMonitoringEvents, corporateMonitoringEvents.id, { tableName: "corporate_monitoring_events" }),
  cropYieldPrediction: createRepository(cropYieldPrediction, cropYieldPrediction.id, { tableName: "crop_yield_prediction" }),
  crossborderAgriTrade: createRepository(crossborderAgriTrade, crossborderAgriTrade.id, { tableName: "crossborder_agri_trade" }),
  customerApprovals: createRepository(customerApprovals, customerApprovals.id, { tableName: "customerApprovals" }),
  customerBillPayments: createRepository(customerBillPayments, customerBillPayments.id, { tableName: "customerBillPayments" }),
  customerCardEvents: createRepository(customerCardEvents, customerCardEvents.id, { tableName: "customerCardEvents" }),
  customerSavedBillers: createRepository(customerSavedBillers, customerSavedBillers.id, { tableName: "customerSavedBillers" }),
  customerSessionPreferences: createRepository(customerSessionPreferences, customerSessionPreferences.id, { tableName: "customerSessionPreferences" }),
  customerStatementExports: createRepository(customerStatementExports, customerStatementExports.id, { tableName: "customerStatementExports" }),
  efassReturns: createRepository(efassReturns, efassReturns.id, { tableName: "efass_returns" }),
  equipmentLeasing: createRepository(equipmentLeasing, equipmentLeasing.id, { tableName: "equipment_leasing" }),
  farmBoundaryMapping: createRepository(farmBoundaryMapping, farmBoundaryMapping.id, { tableName: "farm_boundary_mapping" }),
  fisheriesAquaculture: createRepository(fisheriesAquaculture, fisheriesAquaculture.id, { tableName: "fisheries_aquaculture" }),
  insurancePortfolioAnalytics: createRepository(insurancePortfolioAnalytics, insurancePortfolioAnalytics.id, { tableName: "insurance_portfolio_analytics" }),
  interactiveUssdAgri: createRepository(interactiveUssdAgri, interactiveUssdAgri.id, { tableName: "interactive_ussd_agri" }),
  kycDataQualityMetrics: createRepository(kycDataQualityMetrics, kycDataQualityMetrics.id, { tableName: "kyc_data_quality_metrics" }),
  kycTierHistory: createRepository(kycTierHistory, kycTierHistory.id, { tableName: "kyc_tier_history" }),
  kycTiers: createRepository(kycTiers, kycTiers.id, { tableName: "kyc_tiers" }),
  livestockFinance: createRepository(livestockFinance, livestockFinance.id, { tableName: "livestock_finance" }),
  livestockInsurance: createRepository(livestockInsurance, livestockInsurance.id, { tableName: "livestock_insurance" }),
  livestockManagement: createRepository(livestockManagement, livestockManagement.id, { tableName: "livestock_management" }),
  multiPerilCropInsurance: createRepository(multiPerilCropInsurance, multiPerilCropInsurance.id, { tableName: "multi_peril_crop_insurance" }),
  nfiuFilings: createRepository(nfiuFilings, nfiuFilings.id, { tableName: "nfiu_filings" }),
  nirsalAgroGeocoop: createRepository(nirsalAgroGeocoop, nirsalAgroGeocoop.id, { tableName: "nirsal_agro_geocoop" }),
  nirsalCreditGuarantee: createRepository(nirsalCreditGuarantee, nirsalCreditGuarantee.id, { tableName: "nirsal_credit_guarantee" }),
  parametricInsuranceIot: createRepository(parametricInsuranceIot, parametricInsuranceIot.id, { tableName: "parametric_insurance_iot" }),
  partnerApprovalRecords: createRepository(partnerApprovalRecords, partnerApprovalRecords.id, { tableName: "partnerApprovalRecords" }),
  partnerOnboardingRecords: createRepository(partnerOnboardingRecords, partnerOnboardingRecords.id, { tableName: "partnerOnboardingRecords" }),
  postHarvestLossTracker: createRepository(postHarvestLossTracker, postHarvestLossTracker.id, { tableName: "post_harvest_loss_tracker" }),
  qualityCertification: createRepository(qualityCertification, qualityCertification.id, { tableName: "quality_certification" }),
  riskScores: createRepository(riskScores, riskScores.id, { tableName: "risk_scores" }),
  sanctionsScreenings: createRepository(sanctionsScreenings, sanctionsScreenings.id, { tableName: "sanctions_screenings" }),
  satelliteCropMonitor: createRepository(satelliteCropMonitor, satelliteCropMonitor.id, { tableName: "satellite_crop_monitor" }),
  smsAlertNotification: createRepository(smsAlertNotification, smsAlertNotification.id, { tableName: "sms_alert_notification" }),
  smsBankingGateway: createRepository(smsBankingGateway, smsBankingGateway.id, { tableName: "sms_banking_gateway" }),
  smsOtpService: createRepository(smsOtpService, smsOtpService.id, { tableName: "sms_otp_service" }),
  soilAnalysis: createRepository(soilAnalysis, soilAnalysis.id, { tableName: "soil_analysis" }),
  telegramBankingCommands: createRepository(telegramBankingCommands, telegramBankingCommands.id, { tableName: "telegram_banking_commands" }),
  telegramBotGateway: createRepository(telegramBotGateway, telegramBotGateway.id, { tableName: "telegram_bot_gateway" }),
  telegramKycBot: createRepository(telegramKycBot, telegramKycBot.id, { tableName: "telegram_kyc_bot" }),
  telegramMiniApp: createRepository(telegramMiniApp, telegramMiniApp.id, { tableName: "telegram_mini_app" }),
  telegramNotification: createRepository(telegramNotification, telegramNotification.id, { tableName: "telegram_notification" }),
  transactionAlerts: createRepository(transactionAlerts, transactionAlerts.id, { tableName: "transaction_alerts" }),
  transactionMonitoringRules: createRepository(transactionMonitoringRules, transactionMonitoringRules.id, { tableName: "transaction_monitoring_rules" }),
  uboGraphEdges: createRepository(uboGraphEdges, uboGraphEdges.id, { tableName: "ubo_graph_edges" }),
  uboGraphNodes: createRepository(uboGraphNodes, uboGraphNodes.id, { tableName: "ubo_graph_nodes" }),
  ussdBankingGateway: createRepository(ussdBankingGateway, ussdBankingGateway.id, { tableName: "ussd_banking_gateway" }),
  ussdMultilingual: createRepository(ussdMultilingual, ussdMultilingual.id, { tableName: "ussd_multilingual" }),
  ussdSimToolkit: createRepository(ussdSimToolkit, ussdSimToolkit.id, { tableName: "ussd_sim_toolkit" }),
  ussdTransactionEngine: createRepository(ussdTransactionEngine, ussdTransactionEngine.id, { tableName: "ussd_transaction_engine" }),
  voiceAgentEscalation: createRepository(voiceAgentEscalation, voiceAgentEscalation.id, { tableName: "voice_agent_escalation" }),
  voiceAsrNigerian: createRepository(voiceAsrNigerian, voiceAsrNigerian.id, { tableName: "voice_asr_nigerian" }),
  voiceBankingGateway: createRepository(voiceBankingGateway, voiceBankingGateway.id, { tableName: "voice_banking_gateway" }),
  voiceBiometricAuth: createRepository(voiceBiometricAuth, voiceBiometricAuth.id, { tableName: "voice_biometric_auth" }),
  voiceCallAnalytics: createRepository(voiceCallAnalytics, voiceCallAnalytics.id, { tableName: "voice_call_analytics" }),
  voiceIvrMenu: createRepository(voiceIvrMenu, voiceIvrMenu.id, { tableName: "voice_ivr_menu" }),
  voiceNluBanking: createRepository(voiceNluBanking, voiceNluBanking.id, { tableName: "voice_nlu_banking" }),
  voiceTtsNigerian: createRepository(voiceTtsNigerian, voiceTtsNigerian.id, { tableName: "voice_tts_nigerian" }),
  warehouseManagement: createRepository(warehouseManagement, warehouseManagement.id, { tableName: "warehouse_management" }),
  whatsappBankingFlows: createRepository(whatsappBankingFlows, whatsappBankingFlows.id, { tableName: "whatsapp_banking_flows" }),
  whatsappBusinessGateway: createRepository(whatsappBusinessGateway, whatsappBusinessGateway.id, { tableName: "whatsapp_business_gateway" }),
  whatsappDocumentService: createRepository(whatsappDocumentService, whatsappDocumentService.id, { tableName: "whatsapp_document_service" }),
  whatsappNotification: createRepository(whatsappNotification, whatsappNotification.id, { tableName: "whatsapp_notification" }),
  whatsappPaymentIntegration: createRepository(whatsappPaymentIntegration, whatsappPaymentIntegration.id, { tableName: "whatsapp_payment_integration" }),
};

// ── Helper: DB-first, seed-fallback ──

type SeedDataGetter<T> = () => { items: T[]; total: number };

async function dbFirstList<T>(
  repo: { findAll: (p?: any) => Promise<{ items: T[]; total: number; page: number; limit: number; totalPages: number }> },
  seedGetter: SeedDataGetter<T>,
  pagination?: { page?: number; limit?: number }
): Promise<{ items: T[]; total: number; source: "database" | "seed" }> {
  try {
    const db = await getDb();
    if (db) {
      const result = await repo.findAll(pagination);
      if (result.total > 0) {
        return { items: result.items, total: result.total, source: "database" };
      }
    }
  } catch (error) {
    logger.debug("DB query failed, falling back to seed data", { error: String(error) });
  }
  const seed = seedGetter();
  return { items: seed.items, total: seed.total, source: "seed" };
}

async function dbFirstCreate<TInsert, TSelect>(
  repo: { create: (data: TInsert) => Promise<TSelect | null> },
  data: TInsert,
  seedFallback: () => TSelect
): Promise<{ item: TSelect; source: "database" | "seed" }> {
  try {
    const db = await getDb();
    if (db) {
      const result = await repo.create(data);
      if (result) {
        return { item: result, source: "database" };
      }
    }
  } catch (error) {
    logger.debug("DB create failed, using seed fallback", { error: String(error) });
  }
  return { item: seedFallback(), source: "seed" };
}

// ── Route Registration ──

// Route config: maps Express API path → repository + seed data array reference
interface RouteConfig {
  basePath: string;
  repo: keyof typeof repos;
  idParam: string;
  domain: string;
}

const routeConfigs: RouteConfig[] = [
  // Core Banking
  { basePath: "/api/db/accounts", repo: "accounts", idParam: "accountId", domain: "Core Banking" },
  { basePath: "/api/db/transactions", repo: "transactions", idParam: "transactionId", domain: "Core Banking" },
  { basePath: "/api/db/transfers", repo: "transfers", idParam: "transferId", domain: "Payments" },
  { basePath: "/api/db/loans", repo: "loans", idParam: "loanId", domain: "Lending" },
  { basePath: "/api/db/loan-repayments", repo: "loanRepayments", idParam: "repaymentId", domain: "Lending" },
  // GL & Accounting
  { basePath: "/api/db/gl-accounts", repo: "glAccounts", idParam: "glAccountCode", domain: "Accounting" },
  { basePath: "/api/db/journal-entries", repo: "journalEntries", idParam: "entryId", domain: "Accounting" },
  { basePath: "/api/db/trial-balances", repo: "trialBalances", idParam: "trialBalanceId", domain: "Accounting" },
  // Settlements
  { basePath: "/api/db/settlements", repo: "settlements", idParam: "settlementId", domain: "Payments" },
  // KYC/AML
  { basePath: "/api/db/aml-alerts", repo: "amlAlerts", idParam: "alertId", domain: "Compliance" },
  { basePath: "/api/db/kyc-verifications", repo: "kycVerifications", idParam: "verificationId", domain: "Compliance" },
  // Treasury & FX
  { basePath: "/api/db/fx-trades", repo: "fxTrades", idParam: "tradeId", domain: "Treasury" },
  { basePath: "/api/db/nostro-accounts", repo: "nostroAccounts", idParam: "nostroId", domain: "Treasury" },
  // SWIFT & NIP
  { basePath: "/api/db/swift-messages", repo: "swiftMessages", idParam: "messageId", domain: "Payments" },
  { basePath: "/api/db/nip-transactions", repo: "nipTransactions", idParam: "nipId", domain: "Payments" },
  // Cards
  { basePath: "/api/db/card-transactions", repo: "cardTransactions", idParam: "cardTxnId", domain: "Cards" },
  { basePath: "/api/db/customer-cards", repo: "customerCards", idParam: "cardId", domain: "Cards" },
  // Audit
  { basePath: "/api/db/audit-trail", repo: "auditTrail", idParam: "auditId", domain: "Audit" },
  // Customers (direct DB)
  { basePath: "/api/db/customers", repo: "customers", idParam: "customerId", domain: "Core Banking" },
  // Tenants
  { basePath: "/api/db/tenants", repo: "tenants", idParam: "tenantId", domain: "Platform" },
  // Billing
  { basePath: "/api/db/billing-accounts", repo: "billingAccounts", idParam: "id", domain: "Billing" },
  { basePath: "/api/db/billing-invoices", repo: "billingInvoices", idParam: "id", domain: "Billing" },
  // Agriculture
  { basePath: "/api/db/farmers", repo: "farmers", idParam: "id", domain: "Agriculture" },
  { basePath: "/api/db/agri-loans", repo: "agriLoans", idParam: "id", domain: "Agriculture" },
  { basePath: "/api/db/crop-insurance", repo: "cropInsurancePolicies", idParam: "id", domain: "Agriculture" },
  // Islamic Banking
  { basePath: "/api/db/murabaha-contracts", repo: "murabahaContracts", idParam: "id", domain: "Islamic Banking" },
  { basePath: "/api/db/ijara-contracts", repo: "ijaraContracts", idParam: "id", domain: "Islamic Banking" },
  { basePath: "/api/db/mudarabah-contracts", repo: "mudarabahContracts", idParam: "id", domain: "Islamic Banking" },
  // Trade Finance
  { basePath: "/api/db/letters-of-credit", repo: "lettersOfCredit", idParam: "id", domain: "Trade Finance" },
  { basePath: "/api/db/bank-guarantees", repo: "bankGuarantees", idParam: "id", domain: "Trade Finance" },
  { basePath: "/api/db/warehouse-receipts", repo: "warehouseReceipts", idParam: "id", domain: "Commodities" },
  // Specialty
  { basePath: "/api/db/mortgage-applications", repo: "mortgageApplications", idParam: "id", domain: "Mortgage" },
  { basePath: "/api/db/education-loans", repo: "educationLoans", idParam: "id", domain: "Education" },
  { basePath: "/api/db/esusu-groups", repo: "esusuGroups", idParam: "id", domain: "Esusu" },
  { basePath: "/api/db/virtual-accounts", repo: "virtualAccounts", idParam: "id", domain: "Virtual Accounts" },
  { basePath: "/api/db/agent-banking-agents", repo: "agentBankingAgents", idParam: "id", domain: "Agent Banking" },
  { basePath: "/api/db/lending-groups", repo: "lendingGroups", idParam: "id", domain: "Lending" },
  // Operations
  { basePath: "/api/db/teller-sessions", repo: "tellerSessions", idParam: "id", domain: "Operations" },
  { basePath: "/api/db/teller-transactions", repo: "tellerTransactions", idParam: "id", domain: "Operations" },
  { basePath: "/api/db/vault-operations", repo: "vaultOperations", idParam: "id", domain: "Operations" },
  { basePath: "/api/db/workflow-cases", repo: "workflowCases", idParam: "id", domain: "Workflow" },
  { basePath: "/api/db/operator-actions", repo: "operatorActions", idParam: "id", domain: "Workflow" },
  // Identity & KYB
  { basePath: "/api/db/identity-profiles", repo: "identityProfiles", idParam: "id", domain: "Identity" },
  // Disputes & Reconciliation
  { basePath: "/api/db/dispute-cases", repo: "disputeCases", idParam: "id", domain: "Disputes" },
  { basePath: "/api/db/reconciliation-runs", repo: "reconciliationRuns", idParam: "id", domain: "Reconciliation" },
  // ERP & Regulatory
  { basePath: "/api/db/erpnext-sync-jobs", repo: "erpnextSyncJobs", idParam: "id", domain: "ERP" },
  { basePath: "/api/db/regulatory-reports", repo: "regulatoryReports", idParam: "id", domain: "Regulatory" },
  // Escrow
  { basePath: "/api/db/escrow-accounts", repo: "escrowAccounts", idParam: "escrowId", domain: "Escrow" },
  { basePath: "/api/db/escrow-parties", repo: "escrowParties", idParam: "id", domain: "Escrow" },
  { basePath: "/api/db/escrow-transactions", repo: "escrowTransactions", idParam: "txId", domain: "Escrow" },
  { basePath: "/api/db/escrow-milestones", repo: "escrowMilestones", idParam: "milestoneId", domain: "Escrow" },
  { basePath: "/api/db/escrow-disputes", repo: "escrowDisputes", idParam: "disputeId", domain: "Escrow" },
  { basePath: "/api/db/escrow-documents", repo: "escrowDocuments", idParam: "documentId", domain: "Escrow" },
  { basePath: "/api/db/escrow-fees", repo: "escrowFees", idParam: "feeId", domain: "Escrow" },
  { basePath: "/api/db/escrow-interest", repo: "escrowInterestAccruals", idParam: "accrualId", domain: "Escrow" },
  { basePath: "/api/db/escrow-regulatory", repo: "escrowRegulatoryReports", idParam: "reportId", domain: "Escrow" },
  { basePath: "/api/db/escrow-audit", repo: "escrowAuditLog", idParam: "auditId", domain: "Escrow" },
  // Security
  { basePath: "/api/db/scratch-cards", repo: "scratchCards", idParam: "id", domain: "Security" },
  { basePath: "/api/db/card-batches", repo: "cardBatches", idParam: "id", domain: "Security" },
  { basePath: "/api/db/pin-verifications", repo: "pinVerifications", idParam: "id", domain: "Security" },
  { basePath: "/api/db/grid-cards", repo: "gridCards", idParam: "id", domain: "Security" },
  { basePath: "/api/db/crypto-keys", repo: "cryptoKeys", idParam: "id", domain: "Security" },
  { basePath: "/api/db/mfa-enrollments", repo: "mfaEnrollments", idParam: "id", domain: "Security" },
  { basePath: "/api/db/mfa-policies", repo: "mfaPolicies", idParam: "id", domain: "Security" },
  { basePath: "/api/db/otp-records", repo: "otpRecords", idParam: "id", domain: "Security" },
  { basePath: "/api/db/session-records", repo: "sessionRecords", idParam: "id", domain: "Security" },
  { basePath: "/api/db/api-keys", repo: "apiKeys", idParam: "id", domain: "Security" },
  { basePath: "/api/db/security-events", repo: "securityEvents", idParam: "id", domain: "Security" },
  { basePath: "/api/db/certificates", repo: "certificates", idParam: "id", domain: "Security" },
  // Platform Security Hardening
  { basePath: "/api/db/jwt-validations", repo: "jwtValidations", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/route-schemas", repo: "routeSchemas", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/sql-queries", repo: "sqlQueries", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/vault-secrets", repo: "vaultSecrets", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/pin-hashes", repo: "pinHashes", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/docker-hardening", repo: "dockerHardeningChecks", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/pkce-flows", repo: "pkceFlows", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/token-families", repo: "tokenFamilies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/mtls-nodes", repo: "mtlsNodes", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/body-limits", repo: "bodyLimitRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/kms-keys", repo: "kmsKeys", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/tls-configs", repo: "tlsConfigs", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/correlation-rules", repo: "correlationRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/pci-scans", repo: "pciScans", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/api-key-policies", repo: "apiKeyPolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/path-validations", repo: "pathValidationRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/key-rotations", repo: "keyRotationSchedules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/network-policies", repo: "networkPolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/vault-engines", repo: "vaultEngines", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/anomaly-models", repo: "anomalyModels", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/ndpr-records", repo: "ndprRecords", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/output-encoding", repo: "outputEncodingRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/image-scans", repo: "imageScans", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/waf-rules", repo: "wafRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/ddos-rules", repo: "ddosRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/ip-rules", repo: "ipRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/siem-pipelines", repo: "siemPipelines", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/cbn-compliance", repo: "cbnComplianceChecks", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/egress-policies", repo: "egressPolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/incidents", repo: "incidents", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/immutable-audit", repo: "immutableAuditBlocks", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/soc2-evidence", repo: "soc2Evidence", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/pentest-scans", repo: "pentestScans", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/sri-hashes", repo: "sriHashes", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/csp-policies", repo: "cspPolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/frame-policies", repo: "framePolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/device-profiles", repo: "deviceProfiles", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/aml-risk-scores", repo: "amlRiskScores", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/sar-reports-aml", repo: "sarReports", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/ctr-reports-aml", repo: "ctrReports", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/aml-cases", repo: "amlCases", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/watchlist-sources", repo: "watchlistSources", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/adverse-media-scans", repo: "adverseMediaScans", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/beneficial-owners", repo: "beneficialOwners", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/txn-pattern-analyses", repo: "txnPatternAnalyses", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/goaml-reports", repo: "goamlReports", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/aml-compliance-metrics", repo: "amlComplianceMetrics", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/sanctions-batch-runs", repo: "sanctionsBatchRuns", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/aml-training-records", repo: "amlTrainingRecords", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/wire-transfer-monitor", repo: "wireTransferMonitor", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/regulatory-reports-aml", repo: "amlRegulatoryReports", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/typology-matches", repo: "typologyMatches", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/redis-cache-entries", repo: "redisCacheEntries", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/redis-sessions", repo: "redisSessions", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/cache-invalidations", repo: "cacheInvalidations", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/bloom-filters", repo: "bloomFilters", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/sorted-set-rankings", repo: "sortedSetRankings", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/pgbouncer-pools", repo: "pgbouncerPools", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/query-cache-entries", repo: "queryCacheEntries", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/prepared-statements", repo: "preparedStatements", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/table-partitions", repo: "tablePartitions", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/materialized-views-perf", repo: "materializedViews", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/hot-data-caches", repo: "hotDataCaches", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/batch-aggregator-configs", repo: "batchAggregatorConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/keepalive-configs", repo: "keepaliveConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/compression-configs", repo: "compressionConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/grpc-services", repo: "grpcServices", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/route-trie-stats", repo: "routeTrieStats", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/stream-response-configs", repo: "streamResponseConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/http2-connections", repo: "http2Connections", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/coalescing-rules", repo: "coalescingRules", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/fast-json-schemas", repo: "fastJsonSchemas", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/sw-cache-strategies", repo: "swCacheStrategies", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/virtual-scroll-configs", repo: "virtualScrollConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/memoization-targets", repo: "memoizationTargets", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/bundle-split-configs", repo: "bundleSplitConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/optimistic-ui-configs", repo: "optimisticUIConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/kafka-consumer-groups", repo: "kafkaConsumerGroups", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/kafka-batch-producers", repo: "kafkaBatchProducers", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/avro-schemas", repo: "avroSchemas", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/fluvio-smart-modules", repo: "fluvioSmartModules", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/event-dedup-configs", repo: "eventDedupConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/distroless-images", repo: "distrolessImages", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/tb-batch-configs", repo: "tbBatchConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/hpa-configs", repo: "hpaConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/cdn-edge-configs", repo: "cdnEdgeConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/read-replica-configs", repo: "readReplicaConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/keda-scale-triggers", repo: "kedaScaleTriggers", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/prometheus-dashboards", repo: "prometheusDashboards", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/opensearch-index-configs", repo: "opensearchIndexConfigs", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/temporal-memoized-activities", repo: "temporalMemoizedActivities", idParam: "id", domain: "Performance Optimization" },
  { basePath: "/api/db/apisix-plugin-chains", repo: "apisixPluginChains", idParam: "id", domain: "Performance Optimization" },
  // --- Added 97 missing table route configs ---
  { basePath: "/api/db/acgsf-guarantee", repo: "acgsfGuarantee", idParam: "id", domain: "Core Banking" },
  { basePath: "/api/db/adverse-media-hits", repo: "adverseMediaHits", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/agent-farmer-onboarding", repo: "agentFarmerOnboarding", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/agent-kyc-captures", repo: "agentKycCaptures", idParam: "id", domain: "KYC / KYB / Identity" },
  { basePath: "/api/db/aggregation-center", repo: "aggregationCenter", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/agri-esg-impact", repo: "agriEsgImpact", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/agri-evoucher", repo: "agriEvoucher", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/agri-input-marketplace", repo: "agriInputMarketplace", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/agri-iot-sensor", repo: "agriIotSensor", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/agri-logistics", repo: "agriLogistics", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/agri-reinsurance", repo: "agriReinsurance", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/agri-savings-cycles", repo: "agriSavingsCycles", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/animal-id-traceability", repo: "animalIdTraceability", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/area-yield-index-insurance", repo: "areaYieldIndexInsurance", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/billing-accrual-snapshots", repo: "billingAccrualSnapshots", idParam: "id", domain: "Billing & Revenue" },
  { basePath: "/api/db/billing-contract-overrides", repo: "billingContractOverrides", idParam: "id", domain: "Billing & Revenue" },
  { basePath: "/api/db/billing-discount-rules", repo: "billingDiscountRules", idParam: "id", domain: "Billing & Revenue" },
  { basePath: "/api/db/billing-invoice-approvals", repo: "billingInvoiceApprovals", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/billing-invoice-lines", repo: "billingInvoiceLines", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/billing-rate-card-lines", repo: "billingRateCardLines", idParam: "id", domain: "Billing & Revenue" },
  { basePath: "/api/db/billing-rate-cards", repo: "billingRateCards", idParam: "id", domain: "Billing & Revenue" },
  { basePath: "/api/db/billing-rated-events", repo: "billingRatedEvents", idParam: "id", domain: "Billing & Revenue" },
  { basePath: "/api/db/billing-revenue-share-rules", repo: "billingRevenueShareRules", idParam: "id", domain: "Billing & Revenue" },
  { basePath: "/api/db/bureau-checks", repo: "bureauChecks", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/cbn-agri-returns", repo: "cbnAgriReturns", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/cbn-agsmeis", repo: "cbnAgsmeis", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/cbn-anchor-borrowers", repo: "cbnAnchorBorrowers", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/commodity-exchange", repo: "commodityExchange", idParam: "id", domain: "Core Banking" },
  { basePath: "/api/db/commodity-price-intelligence", repo: "commodityPriceIntelligence", idParam: "id", domain: "Core Banking" },
  { basePath: "/api/db/cooperative-credit-scoring", repo: "cooperativeCreditScoring", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/cooperative-financials", repo: "cooperativeFinancials", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/cooperative-management", repo: "cooperativeManagement", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/cooperative-meetings", repo: "cooperativeMeetings", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/corporate-monitoring-events", repo: "corporateMonitoringEvents", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/crop-yield-prediction", repo: "cropYieldPrediction", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/crossborder-agri-trade", repo: "crossborderAgriTrade", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/customer-approvals", repo: "customerApprovals", idParam: "id", domain: "Multi-Tenant Platform" },
  { basePath: "/api/db/customer-bill-payments", repo: "customerBillPayments", idParam: "id", domain: "Multi-Tenant Platform" },
  { basePath: "/api/db/customer-card-events", repo: "customerCardEvents", idParam: "id", domain: "Multi-Tenant Platform" },
  { basePath: "/api/db/customer-saved-billers", repo: "customerSavedBillers", idParam: "id", domain: "Multi-Tenant Platform" },
  { basePath: "/api/db/customer-session-preferences", repo: "customerSessionPreferences", idParam: "id", domain: "Multi-Tenant Platform" },
  { basePath: "/api/db/customer-statement-exports", repo: "customerStatementExports", idParam: "id", domain: "Multi-Tenant Platform" },
  { basePath: "/api/db/efass-returns", repo: "efassReturns", idParam: "id", domain: "KYC / KYB / Identity" },
  { basePath: "/api/db/equipment-leasing", repo: "equipmentLeasing", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/farm-boundary-mapping", repo: "farmBoundaryMapping", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/fisheries-aquaculture", repo: "fisheriesAquaculture", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/insurance-portfolio-analytics", repo: "insurancePortfolioAnalytics", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/interactive-ussd-agri", repo: "interactiveUssdAgri", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/kyc-data-quality-metrics", repo: "kycDataQualityMetrics", idParam: "id", domain: "KYC / KYB / Identity" },
  { basePath: "/api/db/kyc-tier-history", repo: "kycTierHistory", idParam: "id", domain: "KYC / KYB / Identity" },
  { basePath: "/api/db/kyc-tiers", repo: "kycTiers", idParam: "id", domain: "KYC / KYB / Identity" },
  { basePath: "/api/db/livestock-finance", repo: "livestockFinance", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/livestock-insurance", repo: "livestockInsurance", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/livestock-management", repo: "livestockManagement", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/multi-peril-crop-insurance", repo: "multiPerilCropInsurance", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/nfiu-filings", repo: "nfiuFilings", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/nirsal-agro-geocoop", repo: "nirsalAgroGeocoop", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/nirsal-credit-guarantee", repo: "nirsalCreditGuarantee", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/parametric-insurance-iot", repo: "parametricInsuranceIot", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/partner-approval-records", repo: "partnerApprovalRecords", idParam: "id", domain: "Multi-Tenant Platform" },
  { basePath: "/api/db/partner-onboarding-records", repo: "partnerOnboardingRecords", idParam: "id", domain: "Multi-Tenant Platform" },
  { basePath: "/api/db/post-harvest-loss-tracker", repo: "postHarvestLossTracker", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/quality-certification", repo: "qualityCertification", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/risk-scores", repo: "riskScores", idParam: "id", domain: "Risk & Compliance" },
  { basePath: "/api/db/sanctions-screenings", repo: "sanctionsScreenings", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/satellite-crop-monitor", repo: "satelliteCropMonitor", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/sms-alert-notification", repo: "smsAlertNotification", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/sms-banking-gateway", repo: "smsBankingGateway", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/sms-otp-service", repo: "smsOtpService", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/soil-analysis", repo: "soilAnalysis", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/telegram-banking-commands", repo: "telegramBankingCommands", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/telegram-bot-gateway", repo: "telegramBotGateway", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/telegram-kyc-bot", repo: "telegramKycBot", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/telegram-mini-app", repo: "telegramMiniApp", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/telegram-notification", repo: "telegramNotification", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/transaction-alerts", repo: "transactionAlerts", idParam: "id", domain: "Risk & Compliance" },
  { basePath: "/api/db/transaction-monitoring-rules", repo: "transactionMonitoringRules", idParam: "id", domain: "Risk & Compliance" },
  { basePath: "/api/db/ubo-graph-edges", repo: "uboGraphEdges", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/ubo-graph-nodes", repo: "uboGraphNodes", idParam: "id", domain: "AML Enhancement" },
  { basePath: "/api/db/ussd-banking-gateway", repo: "ussdBankingGateway", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/ussd-multilingual", repo: "ussdMultilingual", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/ussd-sim-toolkit", repo: "ussdSimToolkit", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/ussd-transaction-engine", repo: "ussdTransactionEngine", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/voice-agent-escalation", repo: "voiceAgentEscalation", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/voice-asr-nigerian", repo: "voiceAsrNigerian", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/voice-banking-gateway", repo: "voiceBankingGateway", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/voice-biometric-auth", repo: "voiceBiometricAuth", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/voice-call-analytics", repo: "voiceCallAnalytics", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/voice-ivr-menu", repo: "voiceIvrMenu", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/voice-nlu-banking", repo: "voiceNluBanking", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/voice-tts-nigerian", repo: "voiceTtsNigerian", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/warehouse-management", repo: "warehouseManagement", idParam: "id", domain: "Agriculture Enhancement" },
  { basePath: "/api/db/whatsapp-banking-flows", repo: "whatsappBankingFlows", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/whatsapp-business-gateway", repo: "whatsappBusinessGateway", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/whatsapp-document-service", repo: "whatsappDocumentService", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/whatsapp-notification", repo: "whatsappNotification", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/whatsapp-payment-integration", repo: "whatsappPaymentIntegration", idParam: "id", domain: "Channel Banking" },
  { basePath: "/api/db/customer-notifications", repo: "customerNotifications", idParam: "id", domain: "Core Banking" },
];

export function registerDrizzleRoutes(app: any) {
  // Register CRUD routes for each table
  for (const config of routeConfigs) {
    const repo = repos[config.repo] as any;

    // LIST with pagination
    app.get(config.basePath, async (req: any, res: any) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
        const result = await repo.findAll({ page, limit });
        res.json({
          ...result,
          source: result.total > 0 ? "database" : "seed",
          domain: config.domain,
        });
      } catch (error) {
        res.json({ items: [], total: 0, page: 1, limit: 25, totalPages: 0, source: "error", error: String(error) });
      }
    });

    // GET by ID
    app.get(`${config.basePath}/:id`, async (req: any, res: any) => {
      try {
        const item = await repo.findById(req.params.id);
        if (item) {
          res.json({ item, source: "database" });
        } else {
          res.status(404).json({ message: "Not found", source: "database" });
        }
      } catch (error) {
        res.status(500).json({ message: "DB error", error: String(error) });
      }
    });

    // CREATE
    app.post(config.basePath, async (req: any, res: any) => {
      try {
        const item = await repo.create(req.body);
        if (item) {
          res.status(201).json({ item, source: "database" });
        } else {
          res.status(503).json({ message: "Database unavailable" });
        }
      } catch (error) {
        res.status(500).json({ message: "Create failed", error: String(error) });
      }
    });

    // UPDATE
    app.put(`${config.basePath}/:id`, async (req: any, res: any) => {
      try {
        const item = await repo.update(req.params.id, req.body);
        if (item) {
          res.json({ item, source: "database" });
        } else {
          res.status(404).json({ message: "Not found or DB unavailable" });
        }
      } catch (error) {
        res.status(500).json({ message: "Update failed", error: String(error) });
      }
    });

    // DELETE
    app.delete(`${config.basePath}/:id`, async (req: any, res: any) => {
      try {
        const deleted = await repo.delete(req.params.id);
        if (deleted) {
          res.json({ deleted: true, source: "database" });
        } else {
          res.status(404).json({ message: "Not found or DB unavailable" });
        }
      } catch (error) {
        res.status(500).json({ message: "Delete failed", error: String(error) });
      }
    });

    // COUNT
    app.get(`${config.basePath}/stats/count`, async (req: any, res: any) => {
      try {
        const total = await repo.count();
        res.json({ total, source: total > 0 ? "database" : "seed" });
      } catch (error) {
        res.json({ total: 0, source: "error" });
      }
    });
  }

  // ── Database Health & Stats ──

  app.get("/api/db/health", async (_req: any, res: any) => {
    const start = Date.now();
    try {
      const db = await getDb();
      if (!db) {
        res.json({ healthy: false, latencyMs: Date.now() - start, message: "No DATABASE_URL configured" });
        return;
      }
      await db.execute(sql`SELECT 1`);
      res.json({ healthy: true, latencyMs: Date.now() - start, tables: routeConfigs.length });
    } catch (error) {
      res.json({ healthy: false, latencyMs: Date.now() - start, error: String(error) });
    }
  });

  app.get("/api/db/tables", (_req: any, res: any) => {
    const tables = routeConfigs.map(c => ({
      name: c.repo,
      apiPath: c.basePath,
      domain: c.domain,
      idParam: c.idParam,
    }));
    res.json({ items: tables, total: tables.length });
  });

  app.get("/api/db/stats", async (_req: any, res: any) => {
    const stats: { table: string; count: number; domain: string }[] = [];
    for (const config of routeConfigs.slice(0, 20)) {
      try {
        const repo = repos[config.repo] as any;
        const total = await repo.count();
        stats.push({ table: config.repo, count: total, domain: config.domain });
      } catch {
        stats.push({ table: config.repo, count: 0, domain: config.domain });
      }
    }
    const totalRecords = stats.reduce((s, r) => s + r.count, 0);
    res.json({ tables: stats, totalRecords, tablesQueried: stats.length, totalTables: routeConfigs.length });
  });

  logger.info(`[DrizzleRoutes] Registered ${routeConfigs.length} DB-backed CRUD route sets (${routeConfigs.length * 6} endpoints)`);
}
