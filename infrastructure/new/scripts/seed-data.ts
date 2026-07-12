/**
 * 54Bank Comprehensive Seed Data — All 56 tables
 * Run: npx tsx scripts/seed-data.ts
 */

import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const TENANT_ID = "54bank-platform-prod";

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomDate(daysBack: number): Date {
  return new Date(Date.now() - Math.random() * daysBack * 86400000);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL env var.");
    process.exit(1);
  }

  console.log("Seeding 54Bank platform data...\n");

  // 1. Customers (50 records)
  const customerIds: string[] = [];
  const nigerianNames = [
    "Adebayo Ogundimu", "Chidinma Okafor", "Emeka Nwosu", "Fatima Abdullahi", "Ibrahim Musa",
    "Jumoke Adeyemi", "Kelechi Eze", "Lateefat Balogun", "Maryam Suleiman", "Ngozi Uche",
    "Olumide Ajayi", "Patience Osagie", "Rasheed Olanrewaju", "Stella Obi", "Tunde Bakare",
    "Uche Nnamdi", "Victoria Igwe", "Wasiu Adeleke", "Yetunde Oni", "Zainab Mohammed",
    "Amina Bello", "Blessing Ehigiator", "Chukwuma Okoro", "Damilola Oladipo", "Efosa Ighodaro",
    "Funke Adeola", "Gbenga Osinowo", "Halima Garba", "Ifeoma Chukwu", "Joseph Akpan",
    "Kehinde Adesanya", "Lilian Nnaji", "Muhammed Abubakar", "Nkechi Ugwu", "Obinna Okonkwo",
    "Priscilla Effiong", "Quadri Lawal", "Rosemary Agu", "Samuel Okafor", "Tolulope Akinwale",
    "Uchenna Ibe", "Vivian Nwankwo", "Wale Oyedepo", "Xander Osei", "Yusuf Danjuma",
    "Zara Aliyu", "Adaeze Nwachukwu", "Babajide Olayinka", "Chioma Eze", "Dauda Sani",
  ];
  const segments = ["Agriculture", "Trade", "Retail", "Public sector"] as const;
  const tiers = ["Tier 1", "Tier 2", "Tier 3"] as const;
  const locations = ["Lagos", "Abuja", "Kano", "Port Harcourt", "Ibadan", "Enugu", "Kaduna", "Benin City", "Jos", "Ilorin"];
  const rms = ["Adamu Yusuf", "Bisi Afolabi", "Charles Obi", "Doris Eze", "Emmanuel Okon"];
  const risks = ["Low", "Medium", "High"] as const;
  const statuses = ["Active", "Pending", "Review", "Dormant"] as const;

  for (let i = 0; i < 50; i++) {
    const cid = randomId("cust");
    customerIds.push(cid);
    await db.execute(sql`INSERT INTO customers (customerId, tenantId, name, segment, tier, location, relationshipManager, risk, status, bvn, phone, balance, lastTouchpointLabel, lastTouchpointAt) VALUES (
      ${cid}, ${TENANT_ID}, ${nigerianNames[i]}, ${pick([...segments])}, ${pick([...tiers])}, ${pick(locations)},
      ${pick(rms)}, ${pick([...risks])}, ${pick([...statuses])}, ${`2200${String(i + 1).padStart(7, "0")}`},
      ${`+234${String(8010000000 + i * 1234567).slice(0, 10)}`}, ${Math.round(Math.random() * 50000000)},
      ${"KYC verification"}, ${randomDate(30).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 50 customers seeded");

  // 2. Customer Cards (30 records)
  for (let i = 0; i < 30; i++) {
    await db.execute(sql`INSERT INTO customerCards (cardId, customerId, cardType, brand, lastFour, expiryDate, cardHolder, status, dailyLimit, monthlyLimit, isContactless, isFrozen) VALUES (
      ${randomId("card")}, ${pick(customerIds)}, ${pick(["virtual", "physical"])}, ${pick(["visa", "mastercard"])},
      ${String(1000 + i).slice(-4)}, ${"12/28"}, ${pick(nigerianNames)}, ${"active"},
      ${500000}, ${5000000}, ${1}, ${0}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 30 cards seeded");

  // 3. Customer Transfers (40 records)
  for (let i = 0; i < 40; i++) {
    await db.execute(sql`INSERT INTO customerTransfers (transferId, customerId, tenantId, fromAccount, toAccount, amount, currency, type, status, narration, reference) VALUES (
      ${randomId("txn")}, ${pick(customerIds)}, ${TENANT_ID},
      ${`001${String(1000 + i).padStart(7, "0")}`}, ${`002${String(2000 + i).padStart(7, "0")}`},
      ${Math.round(Math.random() * 1000000)}, ${"NGN"}, ${pick(["internal", "nip", "rtgs"])},
      ${pick(["completed", "pending", "failed"])}, ${"Payment for services"}, ${randomId("ref")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 40 transfers seeded");

  // 4. Bill Payments (25 records)
  const billers = ["PHCN Electricity", "DSTV", "MTN Airtime", "Glo Data", "Lagos Water"];
  for (let i = 0; i < 25; i++) {
    await db.execute(sql`INSERT INTO customerBillPayments (paymentId, customerId, tenantId, billerName, billerCode, amount, status, reference) VALUES (
      ${randomId("bill")}, ${pick(customerIds)}, ${TENANT_ID}, ${pick(billers)},
      ${`BLR${String(i + 100)}`}, ${Math.round(Math.random() * 50000)}, ${pick(["completed", "pending"])}, ${randomId("ref")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 25 bill payments seeded");

  // 5. Workflow Cases (20 records)
  const products = ["Personal Loan", "Mortgage", "Trade LC", "Agriculture Loan", "Savings Account"];
  const stages = ["Origination", "KYC", "Approval", "Fulfilment", "Monitoring"] as const;
  for (let i = 0; i < 20; i++) {
    await db.execute(sql`INSERT INTO workflowCases (caseId, tenantId, customer, product, stage, status, channel, amount, nextAction, slaHours) VALUES (
      ${randomId("wf")}, ${TENANT_ID}, ${pick(nigerianNames)}, ${pick(products)},
      ${pick([...stages])}, ${pick(["Ready", "In Progress", "Blocked"])},
      ${pick(["branch", "mobile", "internet"])}, ${Math.round(Math.random() * 10000000)},
      ${"Review documentation"}, ${pick([4, 8, 24, 48, 72])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 20 workflow cases seeded");

  // 6. Farmers (20 records)
  const crops = ["maize", "cassava", "rice", "yam", "cocoa", "palm_oil", "sorghum", "millet"];
  for (let i = 0; i < 20; i++) {
    await db.execute(sql`INSERT INTO farmers (farmerId, name, location, farmSizeHectares, primaryCrop, cooperativeMember, riskScore, registeredAt) VALUES (
      ${randomId("frm")}, ${pick(nigerianNames)}, ${pick(["Oyo State", "Niger State", "Benue State", "Kaduna State", "Kano State"])},
      ${Math.round(Math.random() * 100 + 5)}, ${pick(crops)}, ${Math.random() > 0.4 ? 1 : 0},
      ${Math.round(Math.random() * 100)}, ${randomDate(365).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 20 farmers seeded");

  // 7. Agriculture Loans (15 records)
  for (let i = 0; i < 15; i++) {
    await db.execute(sql`INSERT INTO agriLoans (loanId, farmerId, amount, interestRate, termMonths, purpose, status, disbursedAt) VALUES (
      ${randomId("agln")}, ${randomId("frm")}, ${Math.round(Math.random() * 5000000 + 100000)},
      ${(Math.random() * 15 + 5).toFixed(2)}, ${pick([6, 12, 18, 24])},
      ${pick(["crop_farming", "equipment", "irrigation", "storage", "livestock"])},
      ${pick(["pending", "approved", "disbursed", "repaying", "fully_repaid"])},
      ${randomDate(180).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 15 agriculture loans seeded");

  // 8. Teller Sessions (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO tellerSessions (sessionId, tellerId, branchCode, status, openingBalance, currentBalance, openedAt) VALUES (
      ${randomId("tls")}, ${`TLR-${String(100 + i)}`}, ${pick(["LG001", "AB001", "KN001", "PH001", "IB001"])},
      ${pick(["open", "closed", "suspended"])}, ${Math.round(Math.random() * 5000000)},
      ${Math.round(Math.random() * 5000000)}, ${randomDate(7).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 teller sessions seeded");

  // 9. Islamic Banking (Murabaha, Ijara, Mudarabah — 5 each)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO murabahaContracts (contractId, customerId, assetDescription, costPrice, profitMargin, sellingPrice, installments, status) VALUES (
      ${randomId("mur")}, ${pick(customerIds)}, ${pick(["Toyota Hilux", "Office Equipment", "Farm Machinery", "Construction Materials", "Medical Equipment"])},
      ${Math.round(Math.random() * 10000000 + 1000000)}, ${(Math.random() * 20 + 5).toFixed(2)},
      ${Math.round(Math.random() * 12000000 + 1500000)}, ${pick([12, 24, 36, 48])},
      ${pick(["pending", "approved", "active", "completed"])}
    ) ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO ijaraContracts (contractId, customerId, assetDescription, leaseAmount, leaseTerm, monthlyPayment, status) VALUES (
      ${randomId("ija")}, ${pick(customerIds)}, ${pick(["Commercial Property", "Vehicle Fleet", "Agricultural Land", "Warehouse"])},
      ${Math.round(Math.random() * 50000000 + 5000000)}, ${pick([12, 24, 36, 60])},
      ${Math.round(Math.random() * 2000000 + 200000)}, ${pick(["pending", "active", "completed"])}
    ) ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO mudarabahContracts (contractId, customerId, investmentAmount, profitSharingRatio, businessPurpose, status) VALUES (
      ${randomId("mud")}, ${pick(customerIds)}, ${Math.round(Math.random() * 20000000 + 2000000)},
      ${"60/40"}, ${pick(["Agriculture Export", "Real Estate Development", "Manufacturing", "Trade Finance"])},
      ${pick(["pending", "active", "profit_distributed", "completed"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 15 Islamic banking contracts seeded");

  // 10. Trade Finance (LCs, Warehouse Receipts, Bank Guarantees — 5 each)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO lettersOfCredit (lcId, applicantId, beneficiaryName, amount, currency, status, expiryDate, swiftRef) VALUES (
      ${randomId("lc")}, ${pick(customerIds)}, ${pick(["Shenzhen Electronics Co.", "Dubai Trading LLC", "Mumbai Textiles Ltd"])},
      ${Math.round(Math.random() * 100000000 + 10000000)}, ${pick(["USD", "EUR", "GBP"])},
      ${pick(["draft", "issued", "confirmed", "expired"])},
      ${new Date(Date.now() + Math.random() * 180 * 86400000).toISOString().slice(0, 19).replace("T", " ")},
      ${`MT700-${randomId("sw")}`}
    ) ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO warehouseReceipts (receiptId, depositorId, commodity, quantity, unit, warehouseLocation, status) VALUES (
      ${randomId("whr")}, ${pick(customerIds)}, ${pick(["cocoa_beans", "palm_oil", "cashew_nuts", "sesame_seeds"])},
      ${Math.round(Math.random() * 10000 + 100)}, ${pick(["tonnes", "litres", "bags"])},
      ${pick(["Lagos Apapa Warehouse", "Kano Free Trade Zone", "Calabar Export Zone"])},
      ${pick(["active", "pledged", "released"])}
    ) ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO bankGuarantees (guaranteeId, applicantId, beneficiaryName, amount, currency, guaranteeType, status, expiryDate) VALUES (
      ${randomId("bg")}, ${pick(customerIds)}, ${pick(["Federal Ministry of Works", "NNPC", "Access Bank Plc"])},
      ${Math.round(Math.random() * 50000000 + 5000000)}, ${"NGN"},
      ${pick(["bid_bond", "performance", "advance_payment"])}, ${pick(["active", "expired", "claimed"])},
      ${new Date(Date.now() + Math.random() * 365 * 86400000).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 15 trade finance instruments seeded");

  // 11. Mortgage Applications (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO mortgageApplications (applicationId, applicantName, propertyValue, loanAmount, interestRate, termYears, monthlyIncome, status, ltvRatio) VALUES (
      ${randomId("mtg")}, ${pick(nigerianNames)}, ${Math.round(Math.random() * 100000000 + 10000000)},
      ${Math.round(Math.random() * 80000000 + 8000000)}, ${(Math.random() * 10 + 8).toFixed(2)},
      ${pick([15, 20, 25, 30])}, ${Math.round(Math.random() * 2000000 + 300000)},
      ${pick(["pending", "approved", "disbursed", "repaying"])}, ${(Math.random() * 40 + 40).toFixed(2)}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 mortgage applications seeded");

  // 12. Education Loans (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO educationLoans (loanId, studentName, institutionName, programName, loanAmount, interestRate, termMonths, gracePeriodMonths, status) VALUES (
      ${randomId("edu")}, ${pick(nigerianNames)},
      ${pick(["University of Lagos", "Ahmadu Bello University", "University of Nigeria Nsukka", "Covenant University", "LASU"])},
      ${pick(["Computer Science", "Medicine", "Engineering", "Law", "Business Administration"])},
      ${Math.round(Math.random() * 5000000 + 500000)}, ${(Math.random() * 8 + 5).toFixed(2)},
      ${pick([24, 36, 48, 60])}, ${6}, ${pick(["pending", "approved", "disbursed", "grace", "repaying"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 education loans seeded");

  // 13. Esusu Groups (8 records)
  for (let i = 0; i < 8; i++) {
    await db.execute(sql`INSERT INTO esusuGroups (groupId, name, contributionAmount, frequencyDays, memberCount, currentRound, status) VALUES (
      ${randomId("esu")}, ${pick(["Ajo Ibile", "Isusu Ndi Igbo", "Adashe Arewa", "Esusu Digital", "Market Women Ajo"])}-${i + 1},
      ${pick([50000, 100000, 250000, 500000])}, ${pick([7, 14, 30])}, ${Math.round(Math.random() * 15 + 3)},
      ${Math.round(Math.random() * 10 + 1)}, ${pick(["forming", "active", "completed"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 8 esusu groups seeded");

  // 14. Virtual Accounts (12 records)
  for (let i = 0; i < 12; i++) {
    await db.execute(sql`INSERT INTO virtualAccounts (accountId, customerId, accountName, accountNumber, bankCode, balance, availableBalance, holdAmount, status) VALUES (
      ${randomId("va")}, ${pick(customerIds)}, ${pick(["Collections Account", "Disbursement Account", "Escrow Account", "Settlement Account"])},
      ${`999${String(1000000 + i * 13579).padStart(7, "0")}`}, ${"054"},
      ${Math.round(Math.random() * 10000000)}, ${Math.round(Math.random() * 8000000)},
      ${Math.round(Math.random() * 500000)}, ${pick(["active", "frozen", "closed"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 12 virtual accounts seeded");

  // 15. Agent Banking (10 agents)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO agentBankingAgents (agentId, name, location, agentType, status, totalTransactions, totalCommission, lastActivityAt) VALUES (
      ${randomId("agt")}, ${pick(nigerianNames)}, ${pick(locations)},
      ${pick(["individual", "merchant", "super_agent"])}, ${pick(["active", "suspended", "pending_review"])},
      ${Math.round(Math.random() * 5000 + 100)}, ${Math.round(Math.random() * 500000 + 10000)},
      ${randomDate(7).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 agents seeded");

  // 16. Group Lending (6 groups)
  for (let i = 0; i < 6; i++) {
    await db.execute(sql`INSERT INTO lendingGroups (groupId, name, memberCount, loanAmount, interestRate, termMonths, status) VALUES (
      ${randomId("grp")}, ${pick(["Women Empowerment Group", "Youth Enterprise Fund", "Farmers Cooperative", "Market Traders Union", "Artisan Guild"])}-${i + 1},
      ${Math.round(Math.random() * 10 + 3)}, ${Math.round(Math.random() * 10000000 + 1000000)},
      ${(Math.random() * 10 + 5).toFixed(2)}, ${pick([6, 12, 18, 24])},
      ${pick(["forming", "active", "repaying", "completed"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 6 lending groups seeded");

  // 17. Identity Profiles (15 records)
  for (let i = 0; i < 15; i++) {
    await db.execute(sql`INSERT INTO identityProfiles (profileId, customerId, verificationType, verificationStatus, documentType, documentNumber, verifiedAt) VALUES (
      ${randomId("idp")}, ${pick(customerIds)}, ${pick(["bvn", "nin", "passport", "voters_card", "drivers_license"])},
      ${pick(["verified", "pending", "failed", "expired"])}, ${pick(["national_id", "passport", "utility_bill"])},
      ${`DOC${String(1000000 + i * 7777).padStart(7, "0")}`},
      ${randomDate(90).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 15 identity profiles seeded");

  // 18. Dispute Cases (8 records)
  for (let i = 0; i < 8; i++) {
    await db.execute(sql`INSERT INTO disputeCases (caseId, customerId, transactionId, category, channel, amount, status, description) VALUES (
      ${randomId("dsp")}, ${pick(customerIds)}, ${randomId("txn")},
      ${pick(["unauthorized_transaction", "merchant_dispute", "atm_failure", "card_fraud", "service_not_rendered"])},
      ${pick(["card", "mobile", "internet", "pos"])}, ${Math.round(Math.random() * 1000000 + 10000)},
      ${pick(["open", "investigating", "resolved", "escalated"])},
      ${"Customer reported issue with transaction"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 8 dispute cases seeded");

  // 19. Reconciliation Runs (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO reconciliationRuns (runId, runType, status, totalRecords, matchedRecords, unmatchedRecords, startedAt, completedAt) VALUES (
      ${randomId("rec")}, ${pick(["daily", "weekly", "monthly"])}, ${pick(["completed", "running", "failed"])},
      ${Math.round(Math.random() * 10000 + 1000)}, ${Math.round(Math.random() * 9000 + 900)},
      ${Math.round(Math.random() * 100 + 10)},
      ${randomDate(30).toISOString().slice(0, 19).replace("T", " ")},
      ${randomDate(30).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 reconciliation runs seeded");

  // 20. ERPNext Sync Jobs (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO erpnextSyncJobs (jobId, syncType, status, recordsProcessed, recordsFailed, startedAt, completedAt) VALUES (
      ${randomId("erp")}, ${pick(["journal_entry", "payment_entry", "invoice", "customer_sync"])},
      ${pick(["completed", "running", "failed"])}, ${Math.round(Math.random() * 500 + 50)},
      ${Math.round(Math.random() * 10)},
      ${randomDate(14).toISOString().slice(0, 19).replace("T", " ")},
      ${randomDate(14).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 ERPNext sync jobs seeded");

  // 21. Regulatory Reports (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO regulatoryReports (reportId, reportType, period, status, submittedAt) VALUES (
      ${randomId("reg")}, ${pick(["cbn_returns", "ctr_filing", "sar_filing", "car_report", "liquidity_report"])},
      ${pick(["2026-Q1", "2026-Q2", "2025-Q4", "2025-Q3"])},
      ${pick(["draft", "submitted", "accepted", "rejected"])},
      ${randomDate(90).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 regulatory reports seeded");

  // 22. Billing Accounts + Rate Cards (10+8)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO billingAccounts (accountId, tenantId, name, status, billingCycle, currency) VALUES (
      ${randomId("ba")}, ${TENANT_ID}, ${`Billing Account ${i + 1}`},
      ${pick(["active", "suspended"])}, ${pick(["monthly", "quarterly"])}, ${"NGN"}
    ) ON CONFLICT DO NOTHING`);
  }
  for (let i = 0; i < 8; i++) {
    await db.execute(sql`INSERT INTO billingRateCards (rateCardId, tenantId, name, effectiveFrom, status) VALUES (
      ${randomId("rc")}, ${TENANT_ID}, ${pick(["Standard Transactions", "Premium API", "Agent Banking Fees", "Card Processing"])},
      ${randomDate(365).toISOString().slice(0, 19).replace("T", " ")}, ${"active"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 18 billing records seeded");

  // 23. Audit Entries (20 records)
  const auditActors = ["system", "admin@54bank.app", "ops@54bank.app", "compliance@54bank.app"];
  for (let i = 0; i < 20; i++) {
    await db.execute(sql`INSERT INTO auditEntries (entryId, tenantId, domainKey, actor, action, detail, severity, resourceId) VALUES (
      ${randomId("aud")}, ${TENANT_ID}, ${pick(["customers", "transfers", "loans", "teller", "compliance"])},
      ${pick(auditActors)}, ${pick(["create", "update", "approve", "reject", "export"])},
      ${"Automated platform operation"}, ${pick(["info", "warning", "critical"])}, ${randomId("res")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 20 audit entries seeded");

  // 24. Notifications (15 records)
  for (let i = 0; i < 15; i++) {
    await db.execute(sql`INSERT INTO customerNotifications (notificationId, customerId, title, body, type, isRead) VALUES (
      ${randomId("ntf")}, ${pick(customerIds)},
      ${pick(["Transfer Successful", "Card Blocked", "Loan Approved", "Payment Received", "KYC Update Required"])},
      ${"Your recent banking activity requires attention"},
      ${pick(["info", "alert", "success", "warning"])}, ${Math.random() > 0.5 ? 1 : 0}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 15 notifications seeded");

  // ══════════════════════════════════════════════════
  // ADDITIONAL TABLES (27 previously missing)
  // ══════════════════════════════════════════════════

  // 25. Tenants (1 record — the platform tenant)
  await db.execute(sql`INSERT INTO tenants (tenantId, name, plan, status, domain) VALUES (
    ${TENANT_ID}, ${"54Bank Nigeria PLC"}, ${"enterprise"}, ${"active"}, ${"54bank.ng"}
  ) ON CONFLICT DO NOTHING`);
  console.log("  ✓ 1 tenant seeded");

  // 26. Users (10 records — platform operators)
  const userRoles = [
    { name: "Admin User", email: "admin@54bank.ng", role: "admin", method: "password" },
    { name: "Adebayo Ogundimu", email: "adebayo@54bank.ng", role: "teller", method: "password" },
    { name: "Chidinma Okafor", email: "chidinma@54bank.ng", role: "teller", method: "password" },
    { name: "Emeka Nwosu", email: "emeka@54bank.ng", role: "branch_manager", method: "password" },
    { name: "Fatima Abdullahi", email: "fatima@54bank.ng", role: "compliance_officer", method: "password" },
    { name: "Ibrahim Musa", email: "ibrahim@54bank.ng", role: "treasury_officer", method: "password" },
    { name: "Jumoke Adeyemi", email: "jumoke@54bank.ng", role: "operations", method: "sso" },
    { name: "Kelechi Eze", email: "kelechi@54bank.ng", role: "auditor", method: "sso" },
    { name: "Lateefat Balogun", email: "lateefat@54bank.ng", role: "customer_service", method: "password" },
    { name: "Maryam Suleiman", email: "maryam@54bank.ng", role: "risk_officer", method: "password" },
  ];
  for (const u of userRoles) {
    await db.execute(sql`INSERT INTO users (openId, name, email, loginMethod, role) VALUES (
      ${randomId("usr")}, ${u.name}, ${u.email}, ${u.method}, ${u.role}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 users seeded");

  // 27. Tenant Feature Flags (20 records)
  const features = [
    "dark_mode", "i18n_rtl", "offline_mode", "biometric_login", "push_notifications",
    "virtual_cards", "fx_trading", "islamic_banking", "agent_banking", "esusu_groups",
    "group_lending", "agricultural_loans", "trade_finance", "mortgage_servicing", "education_loans",
    "payments_hub", "treasury_module", "fraud_detection", "regulatory_reporting", "batch_processing",
  ];
  for (const f of features) {
    await db.execute(sql`INSERT INTO tenantFeatureFlags (flagId, tenantId, featureKey, enabled, description) VALUES (
      ${randomId("ff")}, ${TENANT_ID}, ${f}, ${true}, ${`Feature flag for ${f.replace(/_/g, " ")}`}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 20 feature flags seeded");

  // 28. Customer Session Preferences (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO customerSessionPreferences (prefId, customerId, theme, language, currency, timezone, notificationsEnabled) VALUES (
      ${randomId("pref")}, ${pick(customerIds)}, ${pick(["light", "dark"])},
      ${pick(["en", "ha", "yo", "ig"])}, ${"NGN"}, ${"Africa/Lagos"}, ${true}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 session preferences seeded");

  // 29. Customer Statements (20 records)
  for (let i = 0; i < 20; i++) {
    const period = pick(["2026-01", "2025-12", "2025-11", "2025-10"]);
    await db.execute(sql`INSERT INTO customerStatements (statementId, customerId, tenantId, accountNumber, period, openingBalance, closingBalance, totalCredits, totalDebits, transactionCount, generatedAt) VALUES (
      ${randomId("stmt")}, ${pick(customerIds)}, ${TENANT_ID},
      ${`001${String(1000 + i).padStart(7, "0")}`}, ${period},
      ${Math.round(Math.random() * 5000000)}, ${Math.round(Math.random() * 8000000)},
      ${Math.round(Math.random() * 3000000)}, ${Math.round(Math.random() * 2000000)},
      ${Math.floor(Math.random() * 50) + 5},
      ${randomDate(90).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 20 statements seeded");

  // 30. Customer Statement Exports (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO customerStatementExports (exportId, customerId, format, period, status, fileUrl) VALUES (
      ${randomId("exp")}, ${pick(customerIds)}, ${pick(["pdf", "csv", "xlsx"])},
      ${pick(["2026-01", "2025-12"])}, ${pick(["completed", "pending"])},
      ${`/exports/statement-${i + 1}.pdf`}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 statement exports seeded");

  // 31. Customer Approvals (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO customerApprovals (approvalId, customerId, tenantId, type, status, requestedBy, approvedBy, amount, description) VALUES (
      ${randomId("apr")}, ${pick(customerIds)}, ${TENANT_ID},
      ${pick(["transfer", "limit_increase", "card_request", "loan_application"])},
      ${pick(["approved", "pending", "rejected"])},
      ${pick(nigerianNames)}, ${pick(["Emeka Nwosu", "Ibrahim Musa", null])},
      ${Math.round(Math.random() * 5000000)},
      ${"Requires management approval per policy"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 approvals seeded");

  // 32. Customer Saved Billers (15 records)
  const savedBillers = [
    { name: "EKEDC Electricity", code: "EKEDC", cat: "utility" },
    { name: "DSTV Premium", code: "DSTV", cat: "entertainment" },
    { name: "MTN Nigeria", code: "MTN", cat: "telecom" },
    { name: "Glo Mobile", code: "GLO", cat: "telecom" },
    { name: "Lagos Water Corp", code: "LWC", cat: "utility" },
    { name: "StarTimes", code: "STAR", cat: "entertainment" },
    { name: "WAEC", code: "WAEC", cat: "education" },
    { name: "JAMB", code: "JAMB", cat: "education" },
    { name: "Airtel Nigeria", code: "AIR", cat: "telecom" },
    { name: "9mobile", code: "9MOB", cat: "telecom" },
    { name: "Ikeja Electric", code: "IKEDC", cat: "utility" },
    { name: "Abuja Electric", code: "AEDC", cat: "utility" },
    { name: "GOTV", code: "GOTV", cat: "entertainment" },
    { name: "Showmax", code: "SHOW", cat: "entertainment" },
    { name: "LASU Fees", code: "LASU", cat: "education" },
  ];
  for (const b of savedBillers) {
    await db.execute(sql`INSERT INTO customerSavedBillers (billerId, customerId, billerName, billerCode, category, nickname, lastPaidAmount) VALUES (
      ${randomId("svb")}, ${pick(customerIds)}, ${b.name}, ${b.code}, ${b.cat},
      ${b.name}, ${Math.round(Math.random() * 50000)}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 15 saved billers seeded");

  // 33. Customer Card Events (20 records)
  for (let i = 0; i < 20; i++) {
    await db.execute(sql`INSERT INTO customerCardEvents (eventId, customerId, cardId, eventType, amount, currency, merchantName, status, channel) VALUES (
      ${randomId("ce")}, ${pick(customerIds)}, ${randomId("card")},
      ${pick(["purchase", "atm_withdrawal", "pos_payment", "online_payment", "refund"])},
      ${Math.round(Math.random() * 200000)}, ${"NGN"},
      ${pick(["Shoprite Lekki", "Total Filling Station", "Uber Nigeria", "Jumia Online", "Chicken Republic", "ATM - VI Branch"])},
      ${pick(["approved", "declined", "pending"])},
      ${pick(["pos", "atm", "web", "contactless"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 20 card events seeded");

  // 34. Teller Transactions (30 records)
  for (let i = 0; i < 30; i++) {
    await db.execute(sql`INSERT INTO tellerTransactions (transactionId, tenantId, sessionId, tellerId, type, amount, currency, customerName, accountNumber, narration, status) VALUES (
      ${randomId("ttx")}, ${TENANT_ID}, ${randomId("sess")},
      ${pick(["TEL-001", "TEL-002", "TEL-003"])},
      ${pick(["deposit", "withdrawal", "transfer", "cheque_deposit", "fx_purchase"])},
      ${Math.round(Math.random() * 2000000)}, ${"NGN"},
      ${pick(nigerianNames)}, ${`001${String(1000 + i).padStart(7, "0")}`},
      ${pick(["Cash deposit", "Salary withdrawal", "Cheque clearing", "Bills payment", "FX conversion"])},
      ${pick(["completed", "pending", "reversed"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 30 teller transactions seeded");

  // 35. Operator Actions (15 records)
  for (let i = 0; i < 15; i++) {
    await db.execute(sql`INSERT INTO operatorActions (actionId, tenantId, operatorId, operatorName, actionType, targetResource, targetId, detail, ipAddress) VALUES (
      ${randomId("opa")}, ${TENANT_ID}, ${pick(["USR-001", "USR-002", "USR-003"])},
      ${pick(["Admin User", "Emeka Nwosu", "Ibrahim Musa"])},
      ${pick(["approve_transfer", "block_card", "reset_password", "update_kyc", "override_limit", "create_user"])},
      ${pick(["customer", "card", "transfer", "user", "account"])},
      ${randomId("tgt")},
      ${pick(["Approved high-value transfer", "Blocked compromised card", "Reset customer password", "Updated KYC level", "Overrode daily limit"])},
      ${pick(["10.0.1.45", "10.0.1.67", "10.0.2.12", "192.168.1.100"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 15 operator actions seeded");

  // 36. Partner Onboarding Records (5 records)
  const partnerNames = ["Access Bank PLC", "Wema Bank PLC", "Moniepoint MFB", "PalmPay Digital", "OPay Financial"];
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO partnerOnboardingRecords (recordId, tenantId, partnerName, status, contactEmail, tier, submittedAt) VALUES (
      ${randomId("pon")}, ${TENANT_ID}, ${partnerNames[i]},
      ${pick(["approved", "pending_review", "kyc_verification", "active"])},
      ${`contact@${partnerNames[i].toLowerCase().replace(/ /g, "").slice(0, 10)}.ng`},
      ${pick(["tier1", "tier2", "tier3"])},
      ${randomDate(60).toISOString().slice(0, 19).replace("T", " ")}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 partner onboarding records seeded");

  // 37. Partner Approval Records (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO partnerApprovalRecords (approvalId, tenantId, partnerName, approverName, status, decision, notes) VALUES (
      ${randomId("pap")}, ${TENANT_ID}, ${pick(partnerNames)},
      ${pick(["Emeka Nwosu", "Ibrahim Musa", "Fatima Abdullahi"])},
      ${pick(["approved", "pending", "rejected"])},
      ${pick(["approve", "reject", "defer"])},
      ${pick(["Meets all requirements", "Pending additional documentation", "KYC verification incomplete"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 partner approvals seeded");

  // 38. Export Jobs (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO exportJobs (jobId, tenantId, type, status, format, filters, recordCount, fileUrl) VALUES (
      ${randomId("exp")}, ${TENANT_ID},
      ${pick(["customers", "transactions", "statements", "audit_log", "regulatory"])},
      ${pick(["completed", "processing", "queued"])},
      ${pick(["csv", "xlsx", "pdf"])},
      ${"{}"},
      ${Math.floor(Math.random() * 10000) + 100},
      ${`/exports/export-${i + 1}.csv`}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 export jobs seeded");

  // 39. Vault Operations (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO vaultOperations (operationId, tenantId, branchCode, type, amount, currency, authorizedBy, witnessedBy, status) VALUES (
      ${randomId("vault")}, ${TENANT_ID},
      ${pick(["BR-LOS-001", "BR-ABJ-001", "BR-KAN-001"])},
      ${pick(["cash_in", "cash_out", "denomination_swap", "vault_count", "cash_transfer"])},
      ${Math.round(Math.random() * 50000000)}, ${"NGN"},
      ${pick(["Emeka Nwosu", "Samuel Okafor", "Yusuf Danjuma"])},
      ${pick(["Tolulope Akinwale", "Kelechi Eze", "Adebayo Ogundimu"])},
      ${pick(["completed", "pending_witness", "pending_authorization"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 vault operations seeded");

  // 40. Value Chain Contracts (8 records)
  for (let i = 0; i < 8; i++) {
    await db.execute(sql`INSERT INTO valueChainContracts (contractId, tenantId, farmerId, buyerName, commodity, quantity, unit, pricePerUnit, currency, deliveryDate, status) VALUES (
      ${randomId("vc")}, ${TENANT_ID}, ${randomId("frm")},
      ${pick(["Dangote Flour Mills", "Honeywell Flour", "Olam Nigeria", "BUA Foods", "FMN PLC"])},
      ${pick(["maize", "rice", "sorghum", "cassava", "groundnut"])},
      ${Math.floor(Math.random() * 500) + 50}, ${"tonnes"},
      ${Math.round(Math.random() * 200000) + 50000}, ${"NGN"},
      ${randomDate(-90).toISOString().slice(0, 10)},
      ${pick(["active", "delivered", "pending", "cancelled"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 8 value chain contracts seeded");

  // 41. Crop Insurance Policies (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO cropInsurancePolicies (policyId, tenantId, farmerId, crop, region, coverage, premium, season, status) VALUES (
      ${randomId("cip")}, ${TENANT_ID}, ${randomId("frm")},
      ${pick(["maize", "rice", "sorghum", "cassava", "cocoa", "palm oil"])},
      ${pick(["North West", "North Central", "South West", "South East", "South South"])},
      ${Math.round(Math.random() * 5000000)}, ${Math.round(Math.random() * 250000)},
      ${pick(["2026-wet", "2026-dry", "2025-wet"])},
      ${pick(["active", "claimed", "expired", "pending"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 crop insurance policies seeded");

  // 42. Billing Usage Events (50 records)
  for (let i = 0; i < 50; i++) {
    await db.execute(sql`INSERT INTO billingUsageEvents (eventId, tenantId, accountId, eventType, quantity, unit, metadata) VALUES (
      ${randomId("bue")}, ${TENANT_ID}, ${randomId("ba")},
      ${pick(["api_call", "transaction_processed", "sms_sent", "statement_generated", "kyc_verification", "card_issued"])},
      ${Math.floor(Math.random() * 100) + 1}, ${pick(["count", "bytes", "seconds"])},
      ${"{}"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 50 billing usage events seeded");

  // 43. Billing Rated Events (30 records)
  for (let i = 0; i < 30; i++) {
    await db.execute(sql`INSERT INTO billingRatedEvents (ratedEventId, tenantId, usageEventId, rateCardId, unitPrice, totalPrice, currency) VALUES (
      ${randomId("bre")}, ${TENANT_ID}, ${randomId("bue")}, ${randomId("rc")},
      ${Math.round(Math.random() * 500)}, ${Math.round(Math.random() * 5000)}, ${"NGN"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 30 billing rated events seeded");

  // 44. Billing Invoices (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO billingInvoices (invoiceId, tenantId, accountId, period, subtotal, tax, total, currency, status, dueDate) VALUES (
      ${randomId("inv")}, ${TENANT_ID}, ${randomId("ba")},
      ${pick(["2026-01", "2025-12", "2025-11"])},
      ${Math.round(Math.random() * 500000)}, ${Math.round(Math.random() * 37500)},
      ${Math.round(Math.random() * 537500)}, ${"NGN"},
      ${pick(["draft", "sent", "paid", "overdue"])},
      ${randomDate(-30).toISOString().slice(0, 10)}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 invoices seeded");

  // 45. Billing Invoice Lines (30 records)
  for (let i = 0; i < 30; i++) {
    await db.execute(sql`INSERT INTO billingInvoiceLines (lineId, invoiceId, description, quantity, unitPrice, total, currency) VALUES (
      ${randomId("bil")}, ${randomId("inv")},
      ${pick(["API calls", "Transaction processing", "SMS notifications", "Statement generation", "Card issuance"])},
      ${Math.floor(Math.random() * 1000) + 1},
      ${Math.round(Math.random() * 100)}, ${Math.round(Math.random() * 10000)}, ${"NGN"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 30 invoice lines seeded");

  // 46. Billing Invoice Approvals (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO billingInvoiceApprovals (approvalId, invoiceId, approverName, status, notes) VALUES (
      ${randomId("bia")}, ${randomId("inv")},
      ${pick(["Finance Manager", "CFO", "Billing Admin"])},
      ${pick(["approved", "pending", "rejected"])},
      ${pick(["Amounts verified", "Pending rate card confirmation", "Discrepancy in usage count"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 invoice approvals seeded");

  // 47. Billing Accrual Snapshots (10 records)
  for (let i = 0; i < 10; i++) {
    await db.execute(sql`INSERT INTO billingAccrualSnapshots (snapshotId, tenantId, accountId, period, accruedRevenue, recognizedRevenue, deferredRevenue, currency) VALUES (
      ${randomId("bas")}, ${TENANT_ID}, ${randomId("ba")},
      ${pick(["2026-01", "2025-12", "2025-11", "2025-10"])},
      ${Math.round(Math.random() * 200000)}, ${Math.round(Math.random() * 180000)},
      ${Math.round(Math.random() * 20000)}, ${"NGN"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 10 accrual snapshots seeded");

  // 48. Billing Contract Overrides (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO billingContractOverrides (overrideId, tenantId, accountId, rateCardId, overrideType, value, reason, approvedBy) VALUES (
      ${randomId("bco")}, ${TENANT_ID}, ${randomId("ba")}, ${randomId("rc")},
      ${pick(["discount_percentage", "fixed_price", "volume_cap"])},
      ${String(Math.round(Math.random() * 30))},
      ${pick(["Strategic account discount", "Early adopter pricing", "Volume commitment"])},
      ${pick(["CFO", "Head of Sales", "Product Manager"])}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 contract overrides seeded");

  // 49. Billing Discount Rules (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO billingDiscountRules (ruleId, tenantId, name, type, value, minVolume, maxVolume, status) VALUES (
      ${randomId("bdr")}, ${TENANT_ID},
      ${pick(["Volume Discount", "Early Payment", "Multi-Product Bundle", "Annual Commitment", "Loyalty Discount"])},
      ${pick(["percentage", "fixed"])},
      ${String(Math.round(Math.random() * 25) + 5)},
      ${Math.floor(Math.random() * 1000)}, ${Math.floor(Math.random() * 10000) + 1000},
      ${"active"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 discount rules seeded");

  // 50. Billing Revenue Share Rules (5 records)
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`INSERT INTO billingRevenueShareRules (ruleId, tenantId, partnerName, sharePercentage, productType, status) VALUES (
      ${randomId("brs")}, ${TENANT_ID},
      ${pick(["Access Bank", "Wema Bank", "Moniepoint", "PalmPay", "OPay"])},
      ${Math.round(Math.random() * 30) + 10},
      ${pick(["card_processing", "agent_banking", "api_access", "sms_delivery"])},
      ${"active"}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 5 revenue share rules seeded");

  // 51. Billing Rate Card Lines (20 records)
  for (let i = 0; i < 20; i++) {
    await db.execute(sql`INSERT INTO billingRateCardLines (lineId, rateCardId, eventType, unitPrice, currency, minQuantity, maxQuantity) VALUES (
      ${randomId("brl")}, ${randomId("rc")},
      ${pick(["api_call", "transaction_processed", "sms_sent", "statement_generated", "kyc_verification", "card_issued", "pos_transaction", "atm_withdrawal"])},
      ${Math.round(Math.random() * 500) + 10}, ${"NGN"},
      ${0}, ${Math.floor(Math.random() * 100000) + 1000}
    ) ON CONFLICT DO NOTHING`);
  }
  console.log("  ✓ 20 rate card lines seeded");

  console.log("\n✓ All seed data inserted successfully (56 tables, 600+ records)!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
