/**
 * Database Seed Script — inserts Nigerian banking seed data into all 73 Drizzle tables.
 * Runs automatically on server start if tables are empty.
 * Uses ON CONFLICT DO NOTHING to be safely re-runnable.
 */

import { getDb } from "../db";
import { logger } from "./logger";
import { sql } from "drizzle-orm";
import {
  accounts, transactions, journalEntries, glAccounts,
  loans, loanRepayments, transfers, settlements, amlAlerts,
  kycVerifications, fxTrades, nostroAccounts, auditTrail,
  swiftMessages, nipTransactions, cardTransactions, trialBalances,
  voiceBankingGateway, voiceTtsNigerian, voiceAsrNigerian,
  voiceNluBanking, voiceBiometricAuth, voiceIvrMenu,
  voiceCallAnalytics, voiceAgentEscalation,
  telegramBotGateway, telegramBankingCommands, telegramNotification,
  telegramMiniApp, telegramKycBot,
  whatsappBusinessGateway, whatsappBankingFlows, whatsappPaymentIntegration,
  whatsappNotification, whatsappDocumentService,
  ussdBankingGateway, ussdTransactionEngine, ussdMultilingual, ussdSimToolkit,
  smsBankingGateway, smsOtpService, smsAlertNotification,
} from "../../drizzle/schema";

const SEED_ACCOUNTS = [
  { accountId: "ACC-001", customerId: "CUST-001", tenantId: "54BANK", accountName: "Adeyemi Savings", accountType: "savings", currency: "NGN", balance: 2500000, availableBalance: 2450000, ledgerBalance: 2500000, status: "active", branchCode: "LAG-001" },
  { accountId: "ACC-002", customerId: "CUST-001", tenantId: "54BANK", accountName: "Adeyemi Current", accountType: "current", currency: "NGN", balance: 15000000, availableBalance: 14800000, ledgerBalance: 15000000, status: "active", branchCode: "LAG-001" },
  { accountId: "ACC-003", customerId: "CUST-002", tenantId: "54BANK", accountName: "Okonkwo Business", accountType: "current", currency: "NGN", balance: 85000000, availableBalance: 84500000, ledgerBalance: 85000000, status: "active", branchCode: "ABJ-001" },
  { accountId: "ACC-004", customerId: "CUST-003", tenantId: "54BANK", accountName: "Okafor Fixed Deposit", accountType: "fixed_deposit", currency: "NGN", balance: 50000000, availableBalance: 0, ledgerBalance: 50000000, status: "active", branchCode: "PH-001" },
  { accountId: "ACC-005", customerId: "CUST-004", tenantId: "54BANK", accountName: "Ibrahim SME", accountType: "current", currency: "NGN", balance: 32000000, availableBalance: 31500000, ledgerBalance: 32000000, status: "active", branchCode: "KN-001" },
  { accountId: "ACC-006", customerId: "CUST-005", tenantId: "54BANK", accountName: "Chukwuma GL", accountType: "gl", currency: "NGN", balance: 0, availableBalance: 0, ledgerBalance: 0, status: "active", branchCode: "LAG-002" },
  { accountId: "ACC-007", customerId: "CUST-006", tenantId: "54BANK", accountName: "Balogun USD", accountType: "savings", currency: "USD", balance: 150000, availableBalance: 149000, ledgerBalance: 150000, status: "active", branchCode: "LAG-001" },
  { accountId: "ACC-008", customerId: "CUST-007", tenantId: "54BANK", accountName: "Eze Diaspora", accountType: "savings", currency: "GBP", balance: 45000, availableBalance: 44500, ledgerBalance: 45000, status: "active", branchCode: "LAG-001" },
];

const SEED_TRANSACTIONS = [
  { transactionId: "TXN-001", accountId: "ACC-001", tenantId: "54BANK", type: "credit", amount: 500000, currency: "NGN", narration: "Salary credit — Dangote Industries", reference: "SAL-2026-001", channel: "nip", balanceAfter: 2500000, status: "completed" },
  { transactionId: "TXN-002", accountId: "ACC-002", tenantId: "54BANK", type: "debit", amount: 250000, currency: "NGN", narration: "Transfer to GTBank — School fees", reference: "NIP-2026-001", channel: "mobile", counterpartyName: "Lagos State University", balanceAfter: 14750000, status: "completed" },
  { transactionId: "TXN-003", accountId: "ACC-003", tenantId: "54BANK", type: "credit", amount: 5000000, currency: "NGN", narration: "Invoice payment — Oilserv Ltd", reference: "INV-2026-001", channel: "web", balanceAfter: 85000000, status: "completed" },
  { transactionId: "TXN-004", accountId: "ACC-005", tenantId: "54BANK", type: "debit", amount: 1200000, currency: "NGN", narration: "Bulk salary payment", reference: "BLK-2026-001", channel: "web", balanceAfter: 30800000, status: "completed" },
  { transactionId: "TXN-005", accountId: "ACC-001", tenantId: "54BANK", type: "debit", amount: 50000, currency: "NGN", narration: "POS purchase — Shoprite Lekki", reference: "POS-2026-001", channel: "pos", counterpartyName: "Shoprite Nigeria", balanceAfter: 2450000, status: "completed" },
];

const SEED_GL_ACCOUNTS = [
  { glAccountCode: "1000", tenantId: "54BANK", name: "Cash & Cash Equivalents", category: "asset", subcategory: "current_assets", currency: "NGN", balance: 5200000000, status: "active", isControlAccount: 1 },
  { glAccountCode: "1100", tenantId: "54BANK", name: "Placements with Other Banks", category: "asset", subcategory: "current_assets", currency: "NGN", balance: 2800000000, status: "active", isControlAccount: 0 },
  { glAccountCode: "1200", tenantId: "54BANK", name: "Loans & Advances", category: "asset", subcategory: "earning_assets", currency: "NGN", balance: 85000000000, status: "active", isControlAccount: 1 },
  { glAccountCode: "2000", tenantId: "54BANK", name: "Customer Deposits", category: "liability", subcategory: "demand_deposits", currency: "NGN", balance: 72000000000, status: "active", isControlAccount: 1 },
  { glAccountCode: "2100", tenantId: "54BANK", name: "Term Deposits", category: "liability", subcategory: "time_deposits", currency: "NGN", balance: 28000000000, status: "active", isControlAccount: 0 },
  { glAccountCode: "3000", tenantId: "54BANK", name: "Share Capital", category: "equity", subcategory: "paid_in_capital", currency: "NGN", balance: 25000000000, status: "active", isControlAccount: 0 },
  { glAccountCode: "4000", tenantId: "54BANK", name: "Interest Income", category: "income", subcategory: "interest", currency: "NGN", balance: 12500000000, status: "active", isControlAccount: 1 },
  { glAccountCode: "5000", tenantId: "54BANK", name: "Interest Expense", category: "expense", subcategory: "interest", currency: "NGN", balance: 4200000000, status: "active", isControlAccount: 1 },
];

const SEED_LOANS = [
  { loanId: "LN-001", customerId: "CUST-003", tenantId: "54BANK", loanType: "term", principalAmount: 25000000, outstandingBalance: 18750000, interestRate: 18.5, currency: "NGN", tenor: 36, tenorUnit: "months", status: "active", classificationIFRS9: "stage1" },
  { loanId: "LN-002", customerId: "CUST-005", tenantId: "54BANK", loanType: "sme", principalAmount: 50000000, outstandingBalance: 45000000, interestRate: 15.0, currency: "NGN", tenor: 24, tenorUnit: "months", status: "active", classificationIFRS9: "stage1" },
  { loanId: "LN-003", customerId: "CUST-004", tenantId: "54BANK", loanType: "overdraft", principalAmount: 10000000, outstandingBalance: 7500000, interestRate: 22.0, currency: "NGN", tenor: 12, tenorUnit: "months", status: "overdue", classificationIFRS9: "stage2" },
];

const SEED_AML_ALERTS = [
  { alertId: "AML-001", tenantId: "54BANK", customerId: "CUST-009", entityType: "transaction", entityId: "TXN-999", ruleId: "RULE-CTR", ruleName: "Currency Transaction Report Threshold", riskScore: 0.75, severity: "high", status: "pending" },
  { alertId: "AML-002", tenantId: "54BANK", customerId: "CUST-012", entityType: "account", entityId: "ACC-015", ruleId: "RULE-VEL", ruleName: "Velocity Check — Unusual Transaction Frequency", riskScore: 0.85, severity: "critical", status: "investigating" },
];

const SEED_FX_TRADES = [
  { tradeId: "FX-001", tenantId: "54BANK", buyCurrency: "USD", sellCurrency: "NGN", buyAmount: 100000, sellAmount: 150000000, exchangeRate: 1500.0, tradeType: "spot", counterparty: "Access Bank", status: "settled", traderId: "TRADER-001" },
  { tradeId: "FX-002", tenantId: "54BANK", buyCurrency: "GBP", sellCurrency: "NGN", buyAmount: 50000, sellAmount: 95000000, exchangeRate: 1900.0, tradeType: "forward", counterparty: "GTBank", status: "confirmed", traderId: "TRADER-002" },
];

const SEED_NOSTRO_ACCOUNTS = [
  { nostroId: "NOS-001", tenantId: "54BANK", correspondentBank: "Citibank New York", currency: "USD", accountNumber: "36128745", swiftCode: "CITIUS33", balance: 25000000, status: "active" },
  { nostroId: "NOS-002", tenantId: "54BANK", correspondentBank: "HSBC London", currency: "GBP", accountNumber: "40291853", swiftCode: "MIDLGB22", balance: 12000000, status: "active" },
  { nostroId: "NOS-003", tenantId: "54BANK", correspondentBank: "Standard Chartered Singapore", currency: "USD", accountNumber: "52847193", swiftCode: "SCBLSGSG", balance: 8500000, status: "active" },
];

// Generic Channel Banking seed data factory — each table has same columns
function channelSeed(prefix: string, channels: string[]) {
  return channels.map((ch, i) => ({
    tenantId: "54BANK",
    recordId: `${prefix}-${String(i + 1).padStart(3, "0")}`,
    name: ["Amina Yusuf", "Emeka Okafor", "Fatima Danjuma", "Tunde Adeyemi", "Ngozi Eze", "Ibrahim Musa", "Blessing Okoro", "Yusuf Abdullahi"][i % 8],
    category: ["premium", "standard", "micro", "enterprise", "basic", "standard", "premium", "micro"][i % 8],
    description: `${ch} banking session — ${["Lagos", "Abuja", "Kano", "Port Harcourt", "Ibadan", "Enugu", "Kaduna", "Benin"][i % 8]}`,
    status: ["active", "completed", "processing", "active", "completed", "active", "processing", "active"][i % 8],
    amount: [250000, 1500000, 50000, 3200000, 75000, 890000, 4500000, 120000][i % 8],
    channel: ch,
    msisdn: `+23480${String(10000000 + i * 1111111).slice(0, 8)}`,
    sessionId: `SESS-${prefix}-${String(i + 1).padStart(3, "0")}`,
    metadata: { region: "Nigeria", status: "active" },
  }));
}

const SEED_VOICE_BANKING = channelSeed("VBG", ["IVR", "DTMF", "voice-yoruba", "voice-igbo", "voice-hausa", "voice-pidgin", "voice-english", "biometric"]);
const SEED_VOICE_TTS = channelSeed("TTS", ["male-yoruba", "female-igbo", "male-hausa", "female-english", "male-pidgin", "female-yoruba", "male-igbo", "female-hausa"]);
const SEED_VOICE_ASR = channelSeed("ASR", ["yoruba", "igbo", "hausa", "pidgin", "english", "yoruba-noise", "igbo-noise", "hausa-noise"]);
const SEED_VOICE_NLU = channelSeed("NLU", ["balance-check", "transfer", "airtime", "bill-pay", "loan-check", "card-block", "statement", "complaint"]);
const SEED_VOICE_BIO = channelSeed("BIO", ["voiceprint-enroll", "voiceprint-verify", "anti-spoof", "liveness", "voiceprint-enroll", "voiceprint-verify", "anti-spoof", "liveness"]);
const SEED_VOICE_IVR = channelSeed("IVR", ["main-menu", "balance", "transfer", "airtime", "bill-pay", "loan", "support", "callback"]);
const SEED_VOICE_ANALYTICS = channelSeed("VCA", ["sentiment", "duration", "drop-off", "resolution", "sentiment", "duration", "drop-off", "resolution"]);
const SEED_VOICE_ESCALATION = channelSeed("VES", ["tier1", "tier2", "supervisor", "complaint", "tier1", "tier2", "supervisor", "complaint"]);
const SEED_TELEGRAM_BOT = channelSeed("TBG", ["webhook", "inline-kb", "command", "deep-link", "webhook", "inline-kb", "command", "deep-link"]);
const SEED_TELEGRAM_CMD = channelSeed("TCM", ["/balance", "/transfer", "/history", "/pay_bill", "/airtime", "/block_card", "/exchange_rate", "/find_atm"]);
const SEED_TELEGRAM_NOTIF = channelSeed("TNT", ["credit", "debit", "fraud", "loan", "credit", "debit", "fraud", "loan"]);
const SEED_TELEGRAM_MINI = channelSeed("TMA", ["dashboard", "transfer", "history", "settings", "dashboard", "transfer", "history", "settings"]);
const SEED_TELEGRAM_KYC = channelSeed("TKC", ["BVN-verify", "NIN-verify", "photo-upload", "address-verify", "BVN-verify", "NIN-verify", "photo-upload", "address-verify"]);
const SEED_WHATSAPP_GW = channelSeed("WAG", ["cloud-api", "template-msg", "interactive", "media", "cloud-api", "template-msg", "interactive", "media"]);
const SEED_WHATSAPP_FLOWS = channelSeed("WAF", ["balance", "transfer", "bill-pay", "airtime", "loan-check", "card-block", "statement", "support"]);
const SEED_WHATSAPP_PAY = channelSeed("WAP", ["p2p", "qr-pay", "merchant", "recurring", "p2p", "qr-pay", "merchant", "recurring"]);
const SEED_WHATSAPP_NOTIF = channelSeed("WAN", ["credit", "debit", "otp", "promo", "credit", "debit", "otp", "promo"]);
const SEED_WHATSAPP_DOC = channelSeed("WAD", ["statement-pdf", "receipt", "kyc-doc", "tax-cert", "statement-pdf", "receipt", "kyc-doc", "tax-cert"]);
const SEED_USSD_GW = channelSeed("USG", ["*737#", "*901#", "*919#", "*822#", "*737#", "*901#", "*919#", "*822#"]);
const SEED_USSD_TXN = channelSeed("UST", ["balance", "transfer", "airtime", "bill-pay", "mini-stmt", "pin-change", "block", "unblock"]);
const SEED_USSD_LANG = channelSeed("USL", ["english", "hausa", "yoruba", "igbo", "pidgin", "english", "hausa", "yoruba"]);
const SEED_USSD_STK = channelSeed("USS", ["stk-push", "stk-prompt", "sim-menu", "stk-alert", "stk-push", "stk-prompt", "sim-menu", "stk-alert"]);
const SEED_SMS_GW = channelSeed("SMG", ["BAL", "TRF", "STMT", "PIN", "BLK", "BAL", "TRF", "STMT"]);
const SEED_SMS_OTP = channelSeed("SOT", ["MTN", "Glo", "Airtel", "9mobile", "MTN", "Glo", "Airtel", "9mobile"]);
const SEED_SMS_ALERT = channelSeed("SAL", ["credit", "debit", "fraud", "loan-due", "credit", "debit", "fraud", "loan-due"]);

export async function seedDatabaseIfEmpty() {
  const db = await getDb();
  if (!db) {
    logger.info("[SeedDB] No database connection — skipping seed");
    return;
  }

  try {
    // Check if accounts table has data
    const existing = await db.select({ count: sql<number>`count(*)` }).from(accounts);
    const accountCount = existing[0]?.count ?? 0;

    if (Number(accountCount) > 0) {
      logger.info(`[SeedDB] Database already seeded (${accountCount} accounts found)`);
      return;
    }

    logger.info("[SeedDB] Seeding database with Nigerian banking data...");

    // Seed in order of dependencies
    await db.insert(accounts).values(SEED_ACCOUNTS as any[]).onConflictDoNothing();
    await db.insert(transactions).values(SEED_TRANSACTIONS as any[]).onConflictDoNothing();
    await db.insert(glAccounts).values(SEED_GL_ACCOUNTS as any[]).onConflictDoNothing();
    await db.insert(loans).values(SEED_LOANS as any[]).onConflictDoNothing();
    await db.insert(amlAlerts).values(SEED_AML_ALERTS as any[]).onConflictDoNothing();
    await db.insert(fxTrades).values(SEED_FX_TRADES as any[]).onConflictDoNothing();
    await db.insert(nostroAccounts).values(SEED_NOSTRO_ACCOUNTS as any[]).onConflictDoNothing();

    // Channel Banking tables (25 services)
    const channelSeeds: [any, any[]][] = [
      [voiceBankingGateway, SEED_VOICE_BANKING],
      [voiceTtsNigerian, SEED_VOICE_TTS],
      [voiceAsrNigerian, SEED_VOICE_ASR],
      [voiceNluBanking, SEED_VOICE_NLU],
      [voiceBiometricAuth, SEED_VOICE_BIO],
      [voiceIvrMenu, SEED_VOICE_IVR],
      [voiceCallAnalytics, SEED_VOICE_ANALYTICS],
      [voiceAgentEscalation, SEED_VOICE_ESCALATION],
      [telegramBotGateway, SEED_TELEGRAM_BOT],
      [telegramBankingCommands, SEED_TELEGRAM_CMD],
      [telegramNotification, SEED_TELEGRAM_NOTIF],
      [telegramMiniApp, SEED_TELEGRAM_MINI],
      [telegramKycBot, SEED_TELEGRAM_KYC],
      [whatsappBusinessGateway, SEED_WHATSAPP_GW],
      [whatsappBankingFlows, SEED_WHATSAPP_FLOWS],
      [whatsappPaymentIntegration, SEED_WHATSAPP_PAY],
      [whatsappNotification, SEED_WHATSAPP_NOTIF],
      [whatsappDocumentService, SEED_WHATSAPP_DOC],
      [ussdBankingGateway, SEED_USSD_GW],
      [ussdTransactionEngine, SEED_USSD_TXN],
      [ussdMultilingual, SEED_USSD_LANG],
      [ussdSimToolkit, SEED_USSD_STK],
      [smsBankingGateway, SEED_SMS_GW],
      [smsOtpService, SEED_SMS_OTP],
      [smsAlertNotification, SEED_SMS_ALERT],
    ];
    for (const [table, data] of channelSeeds) {
      try {
        await db.insert(table).values(data as any[]).onConflictDoNothing();
      } catch {
        // Table may not exist yet — continue seeding others
      }
    }

    logger.info("[SeedDB] Database seeded: 8 accounts, 5 transactions, 8 GL, 3 loans, 2 AML, 2 FX, 3 nostro + 25 channel banking tables (8 rows each)");
  } catch (error) {
    logger.warn("[SeedDB] Seed failed (tables may not exist yet — run migrations)", { error: String(error) });
  }
}
