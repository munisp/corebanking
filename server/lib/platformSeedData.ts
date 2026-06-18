// Platform Seed Data — realistic Nigerian banking seed data for all API routes
// Ensures PWA pages always display data when microservices are offline
import type { Express, Request, Response } from "express";

// Proxy fallback data keyed by service path (used by getProxyFallback)
const PROXY_SEEDS: Record<string, unknown[]> = {
  "/v1/accounts": [{"id":"TB-001","name":"NGN Settlement","ledger":1,"balance":"\u20a63B","status":"active"}],
  "/v1/benchmarks": [{"id":"RCB-001","name":"CBN MPR","type":"policy_rate","value":"18.75%","status":"active"}],
  "/v1/biometric-auth-rs/list": [{"id":"BIO-001","name":"Fingerprint Scanner","type":"fingerprint","enrollments":18500,"matchRate":"99.8%","status":"active"},{"id":"BIO-002","name":"Facial Recognition","type":"face","enrollments":12400,"matchRate":"99.2%","status":"active"}],
  "/v1/cache/keys": [{"id":"RD-001","name":"session:*","count":"12,450","memoryMB":"512","ttl":"30min","status":"active"}],
  "/v1/chatbot/intents": [{"id":"INT-001","name":"balance_check","category":"account","confidence":"0.96","status":"active"},{"id":"INT-002","name":"fund_transfer","category":"transaction","confidence":"0.94","status":"active"}],
  "/v1/contingent-liabilities-rs/list": [{"id":"CL-001","name":"Performance Guarantee \u2014 FMoW","type":"guarantee","amount":"\u20a62.4B","status":"active"}],
  "/v1/custody/accounts": [{"id":"CUST-001","name":"FGN Bond Custody","type":"government_bond","value":"\u20a685B","custodian":"CSCS","status":"active"}],
  "/v1/customers": [{"id":"CIF-001","name":"Adewale Ogundimu","bvn":"22345678901","tier":"Tier 3","segment":"Premium","status":"active"},{"id":"CIF-002","name":"Emeka Industries Ltd","rcNumber":"RC-123456","tier":"Corporate","status":"active"},{"id":"CIF-003","name":"Mrs. Fatima Hassan","bvn":"22345678902","tier":"Tier 2","status":"active"}],
  "/v1/eod-runs": [{"id":"EOD-001","name":"EOD Run \u2014 2026-05-13","date":"2026-05-13","duration":"45min","transactions":125400,"status":"completed"}],
  "/v1/escrow/accounts": [{"id":"ESC-001","name":"Property Escrow \u2014 Lekki","type":"real_estate","amount":"\u20a6125M","status":"active"}],
  "/v1/escrow/audit": [{"id":"ESC-AUD-001","name":"Escrow Audit \u2014 Q1 2026","type":"quarterly","findings":2,"status":"completed"}],
  "/v1/escrow/disputes": [{"id":"ESC-DSP-001","name":"Escrow Dispute \u2014 Late Delivery","type":"milestone","amount":"\u20a612M","status":"investigating"}],
  "/v1/escrow/documents": [{"id":"ESC-DOC-001","name":"Property Title","type":"deed","uploadedBy":"Seller","status":"active"}],
  "/v1/escrow/fees": [{"id":"ESC-FEE-001","name":"Escrow Service Fee","type":"flat","amount":"\u20a6250,000","status":"active"}],
  "/v1/escrow/interest": [{"id":"ESC-INT-001","name":"Escrow Interest Accrual","rate":"4.5%","accrued":"\u20a61.2M","status":"active"}],
  "/v1/escrow/milestones": [{"id":"ESC-MS-001","name":"Title Verification Complete","progress":"60%","status":"completed"}],
  "/v1/escrow/notifications": [{"id":"ESC-NOT-001","name":"Milestone Completed","type":"milestone","status":"sent"}],
  "/v1/escrow/regulatory": [{"id":"ESC-REG-001","name":"SCUML Registration","type":"regulatory","status":"compliant"}],
  "/v1/escrow/transactions": [{"id":"ESC-TXN-001","name":"Initial Deposit","type":"deposit","amount":"\u20a662.5M","status":"completed"}],
  "/v1/etd-trading-rs/list": [{"id":"ETD-001","name":"NGN/USD Option \u2014 Sep 2026","type":"option","strike":"\u20a61,680/$","status":"active"}],
  "/v1/executions": [{"id":"SAGA-001","name":"Fund Transfer Saga","steps":5,"completed":5,"status":"completed"}],
  "/v1/expense-mgmt-go/list": [{"id":"EXP-001","name":"IT Infrastructure \u2014 May","category":"IT","amount":"\u20a645M","budget":"\u20a650M","status":"approved"}],
  "/v1/facilities": [{"id":"FAC-001","name":"\u20a62B Term Loan \u2014 Dangote","type":"term_loan","limit":"\u20a62B","utilized":"\u20a61.8B","status":"active"}],
  "/v1/factoring/deals": [{"id":"FACT-001","name":"Invoice Factoring \u2014 Oando","type":"recourse","invoiceValue":"\u20a6450M","status":"active"}],
  "/v1/fatca-crs-rs/list": [{"id":"FATCA-001","name":"US Person Report \u2014 2025","type":"FATCA","reportableAccounts":45,"status":"filed"}],
  "/v1/findings": [{"id":"EXAM-001","name":"CBN Examination \u2014 Q1 2026","type":"regulatory","findings":3,"status":"open"}],
  "/v1/fixed-assets-go/list": [{"id":"FA-001","name":"Head Office \u2014 VI","type":"property","cost":"\u20a64.5B","nbv":"\u20a63.8B","status":"active"}],
  "/v1/history": [{"id":"LIQ-001","name":"LCR \u2014 May 14","lcr":"145%","nsfr":"132%","hqla":"\u20a6180B","status":"compliant"}],
  "/v1/indices": [{"id":"OS-001","name":"transactions-2026","docs":"24.5M","sizeGB":"45","shards":5,"status":"active"}],
  "/v1/insurance-py/insurance_policies": [{"id":"INS-001","name":"Bancassurance \u2014 Life","type":"life","premium":"\u20a62.4B","policyCount":12000,"status":"active"}],
  "/v1/interbank/deals": [{"id":"IB-001","name":"Call Money \u2014 \u20a65B","type":"call","amount":"\u20a65B","rate":"12.5%","status":"active"}],
  "/v1/inventory-py/inventory_items": [{"id":"INV-001","name":"Cheque Books Stock","type":"stationery","quantity":5000,"status":"active"}],
  "/v1/leasing/contracts": [{"id":"LSE-001","name":"Equipment Lease \u2014 Dangote","type":"finance_lease","value":"\u20a62.8B","status":"active"}],
  "/v1/locker-go/list": [{"id":"LOCK-001","name":"Safe Deposit Box \u2014 Small","size":"small","monthlyRent":"\u20a65,000","status":"active"}],
  "/v1/mandates": [{"id":"MND-001","name":"Direct Debit \u2014 DSTV","type":"direct_debit","amount":"\u20a621,000","status":"active"}],
  "/v1/microfinance/groups": [{"id":"MFG-001","name":"Ikeja Market Women Group","members":25,"savingsBalance":"\u20a64.5M","status":"active"}],
  "/v1/migrations": [{"id":"MIG-001","name":"001_initial_schema","appliedAt":"2026-01-15","tables":45,"status":"completed"},{"id":"MIG-002","name":"002_add_kyc_tables","appliedAt":"2026-02-01","tables":12,"status":"completed"}],
  "/v1/pension-py/pension_accounts": [{"id":"PEN-001","name":"RSA \u2014 Adewale Ogundimu","type":"RSA","pfa":"ARM Pension","balance":"\u20a612.4M","status":"active"}],
  "/v1/portfolios": [{"id":"PORT-001","name":"Conservative Portfolio","type":"fixed_income","aum":"\u20a645B","return":"14.2%","status":"active"}],
  "/v1/positions": [{"id":"FXR-001","name":"USD Position","currency":"USD","position":"$28.5M","spotRate":"\u20a61,620","status":"active"}],
  "/v1/profiles": [{"id":"PRC-001","name":"Premium Pricing","tier":"premium","transferFee":"\u20a60","status":"active"}],
  "/v1/project-finance/deals": [{"id":"PF-001","name":"Lekki Deep Sea Port","type":"infrastructure","amount":"\u20a6450B","status":"active"}],
  "/v1/qr-payments-go/list": [{"id":"QR-001","name":"Merchant QR \u2014 Shoprite","type":"static","dailyVolume":"\u20a62.8M","status":"active"}],
  "/v1/remittance/transactions": [{"id":"REM-001","name":"Diaspora \u2014 US\u2192NG","corridor":"US-Nigeria","amount":"$2,400","status":"completed"}],
  "/v1/returns": [{"id":"REG-001","name":"CBN Returns \u2014 April","type":"CBN","frequency":"monthly","status":"filed"}],
  "/v1/rules": [{"id":"AR-001","name":"Double Entry Posting","type":"posting","glCode":"1000","status":"active"},{"id":"AR-002","name":"Interest Accrual","type":"accrual","glCode":"3100","status":"active"}],
  "/v1/safe-deposit-go/list": [{"id":"SDB-001","name":"Box A-001 \u2014 VI","size":"large","annualRent":"\u20a6120,000","status":"active"}],
  "/v1/signature-verification-rs/list": [{"id":"SIG-001","name":"Signature \u2014 Adewale","type":"individual","specimens":2,"status":"active"}],
  "/v1/standing-charges-go/list": [{"id":"SC-001","name":"Account Maintenance","type":"monthly","amount":"\u20a6100","accounts":18000,"status":"active"}],
  "/v1/statements": [{"id":"STMT-001","name":"Monthly \u2014 April","type":"monthly","generated":25400,"delivered":25200,"status":"completed"}],
  "/v1/stress-testing-rs/list": [{"id":"STRESS-001","name":"Credit Stress \u2014 Q1","type":"credit","scenario":"recession","capitalImpact":"-2.1%","status":"completed"}],
  "/v1/syndicated-loans/facilities": [{"id":"SYN-001","name":"\u20a650B \u2014 Dangote","participants":5,"amount":"\u20a650B","status":"active"}],
  "/v1/tables": [{"id":"LH-001","name":"fact_transactions","format":"delta","rows":"89M","sizeGB":"12.4","status":"active"}],
  "/v1/topics": [{"id":"KFK-001","name":"transactions","partitions":12,"status":"active"}],
  "/v1/trust-estate-rs/list": [{"id":"TRU-001","name":"Family Trust \u2014 Ogundimu","type":"discretionary","aum":"\u20a6250M","status":"active"}],
  "/v1/utility-payments/transactions": [{"id":"UTL-001","name":"EKEDC Payment","type":"electricity","amount":"\u20a625,000","status":"completed"}],
  "/v1/wealth/clients": [{"id":"WLT-001","name":"Chief Okonkwo","tier":"UHNW","aum":"\u20a62.4B","products":8,"status":"active"}],
  "/v1/workflows": [{"id":"TW-001","name":"kyc-onboarding","running":45,"completed":"12,400","status":"active"}],
};

// Register proxy fallback data into the fallback registry
export function registerProxySeedFallback(registry: Map<string, unknown[]>): void {
  for (const [path, data] of Object.entries(PROXY_SEEDS)) {
    if (!registry.has(path)) {
      registry.set(path, data);
    }
  }
}

// Register direct GET routes for paths without proxy mapping
export function registerPlatformSeedRoutes(app: Express): void {
  app.get("/api/kyc-enhanced/analytics-dashboard", (_req: Request, res: Response) => {
    const items = [{"id":"KYC-AN-001","name":"BVN Verification Rate","metric":"bvn_rate","value":"98.5%","period":"MTD","status":"active"},{"id":"KYC-AN-002","name":"Avg Onboarding Time","metric":"avg_time","value":"4.2 min","period":"MTD","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/kyc-enhanced/data-quality", (_req: Request, res: Response) => {
    const items = [{"id":"DQ-001","name":"BVN Completeness","field":"bvn","completeness":"99.2%","status":"good"},{"id":"DQ-002","name":"Address Completeness","field":"address","completeness":"87.5%","status":"warning"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/kyc-enhanced/summary", (_req: Request, res: Response) => {
    const items = [{"id":"KYC-S-001","name":"Total Customers","value":"25,400","change":"+450 MTD","status":"active"},{"id":"KYC-S-002","name":"KYC Verified","value":"24,800","change":"+420 MTD","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/authz/roles", (_req: Request, res: Response) => {
    const items = [{"id":"ROLE-001","name":"Branch Manager","permissions":45,"users":120,"status":"active"},{"id":"ROLE-002","name":"Teller","permissions":18,"users":450,"status":"active"},{"id":"ROLE-003","name":"Compliance Officer","permissions":32,"users":15,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/basel/exposures", (_req: Request, res: Response) => {
    const items = [{"id":"BASEL-001","name":"Corporate","category":"corporate","exposure":"\u20a6145B","rwa":"\u20a6116B","riskWeight":"80%","status":"active"},{"id":"BASEL-002","name":"Retail","category":"retail","exposure":"\u20a689B","rwa":"\u20a666.75B","riskWeight":"75%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/cash-pooling/pools", (_req: Request, res: Response) => {
    const items = [{"id":"CP-001","name":"Naira Liquidity Pool","currency":"NGN","balance":"\u20a645.2B","participants":12,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/cheques", (_req: Request, res: Response) => {
    const items = [{"id":"CHQ-001","name":"Cheque Book \u2014 Adewale Ogundimu","serialStart":"54B-0001000","issued":25,"used":12,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/customer-360/profiles", (_req: Request, res: Response) => {
    const items = [{"id":"C360-001","name":"Adewale Ogundimu","segment":"Premium","ltv":"\u20a612.4M","products":5,"status":"active"},{"id":"C360-002","name":"Emeka Industries","segment":"SME","ltv":"\u20a645.2M","products":8,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/dapr/apps", (_req: Request, res: Response) => {
    const items = [{"id":"DAPR-001","name":"transaction-service","port":8100,"protocol":"gRPC","healthStatus":"healthy","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/derivatives/list", (_req: Request, res: Response) => {
    const items = [{"id":"DER-001","name":"NGN/USD Forward \u2014 3M","type":"forward","notional":"$5M","rate":"\u20a61,650/$","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/diaspora/accounts", (_req: Request, res: Response) => {
    const items = [{"id":"DIA-001","name":"Adebayo Johnson (US)","country":"USA","currency":"USD","balance":"$12,450","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/disputes/cases", (_req: Request, res: Response) => {
    const items = [{"id":"DSP-001","name":"ATM Failed Withdrawal \u2014 Ikeja","type":"ATM","amount":"\u20a650,000","status":"investigating"},{"id":"DSP-002","name":"POS Double Debit \u2014 Lekki","type":"POS","amount":"\u20a6125,000","status":"resolved"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/education-loans/loans", (_req: Request, res: Response) => {
    const items = [{"id":"EDU-001","name":"Tuition Loan \u2014 UNILAG","type":"tuition","amount":"\u20a62.5M","status":"disbursed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/engagement/referrals", (_req: Request, res: Response) => {
    const items = [{"id":"REF-001","name":"Adewale \u2192 Tunde","referrer":"Adewale Ogundimu","reward":"\u20a65,000","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/erpnext/sync-jobs", (_req: Request, res: Response) => {
    const items = [{"id":"ERP-001","name":"GL Sync \u2014 Daily","type":"general_ledger","frequency":"daily","records":4500,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/events/topics", (_req: Request, res: Response) => {
    const items = [{"id":"EVT-001","name":"customer.created","partitions":6,"consumers":4,"status":"active"},{"id":"EVT-002","name":"transaction.completed","partitions":12,"consumers":8,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/fraud/screenings", (_req: Request, res: Response) => {
    const items = [{"id":"FRD-001","name":"Card Fraud Screening","type":"realtime","screeningsToday":45000,"flagged":120,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/fx/deals", (_req: Request, res: Response) => {
    const items = [{"id":"FX-001","name":"USD/NGN Spot","type":"spot","amount":"$500K","rate":"\u20a61,620","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/identity/profiles", (_req: Request, res: Response) => {
    const items = [{"id":"IDP-001","name":"Adewale Ogundimu","bvn":"22345678901","nin":"12345678901","status":"verified"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/identity/users", (_req: Request, res: Response) => {
    const items = [{"id":"USR-001","name":"Admin User","email":"admin@54bank.ng","role":"super_admin","status":"active"},{"id":"USR-002","name":"Branch Manager Lagos","role":"branch_manager","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/ifrs9/exposures", (_req: Request, res: Response) => {
    const items = [{"id":"IFRS-001","name":"Stage 1 \u2014 Performing","exposure":"\u20a6180B","ecl":"\u20a61.8B","eclRate":"1.0%","status":"active"},{"id":"IFRS-002","name":"Stage 2 \u2014 Underperforming","exposure":"\u20a625B","ecl":"\u20a62.5B","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/islamic/murabaha", (_req: Request, res: Response) => {
    const items = [{"id":"ISL-001","name":"Home Murabaha \u2014 Lagos","type":"murabaha","amount":"\u20a645M","markup":"15%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/kyc-aml/v1/kyc/records", (_req: Request, res: Response) => {
    const items = [{"id":"KYC-001","name":"Adewale Ogundimu","bvn":"22345678901","tier":"Tier 3","riskLevel":"low","status":"verified"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/lakehouse/datasets", (_req: Request, res: Response) => {
    const items = [{"id":"DS-001","name":"Transaction Analytics","format":"delta","sizeGB":"45","tables":12,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/ledger-recon/runs", (_req: Request, res: Response) => {
    const items = [{"id":"RECON-001","name":"Daily GL Reconciliation","date":"2026-05-14","matched":"99.8%","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/ledger/transfers", (_req: Request, res: Response) => {
    const items = [{"id":"LT-001","name":"Inter-branch \u2014 Lagos\u2192Abuja","amount":"\u20a62.4B","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/loan-calculator", (_req: Request, res: Response) => {
    const items = [{"id":"CALC-001","name":"Personal Loan Calculator","type":"reducing_balance","maxAmount":"\u20a650M","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/mojaloop/transfers", (_req: Request, res: Response) => {
    const items = [{"id":"MOJA-001","name":"Cross-border \u2014 NG\u2192GH","corridor":"Nigeria-Ghana","amount":"\u20a6450,000","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/money-market/deals", (_req: Request, res: Response) => {
    const items = [{"id":"MM-001","name":"TB Purchase \u2014 91D","type":"treasury_bill","amount":"\u20a65B","rate":"12.8%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/mortgage/applications", (_req: Request, res: Response) => {
    const items = [{"id":"MTG-001","name":"Home Loan \u2014 Lekki","type":"residential","amount":"\u20a685M","rate":"NHF 6%","status":"approved"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/nibss/mandates", (_req: Request, res: Response) => {
    const items = [{"id":"NIBSS-001","name":"eBillsPay \u2014 EKEDC","type":"ebills","biller":"Eko Electricity","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/payments", (_req: Request, res: Response) => {
    const items = [{"id":"PAY-001","name":"NIP Transfer","type":"interbank","amount":"\u20a62.5M","sender":"Adewale Ogundimu","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/pos/v1/pos/terminals", (_req: Request, res: Response) => {
    const items = [{"id":"POS-001","name":"POS \u2014 Shoprite Ikeja","tid":"54B-POS-001","dailyVolume":"\u20a64.5M","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/products", (_req: Request, res: Response) => {
    const items = [{"id":"PRD-001","name":"54Save \u2014 Savings","type":"savings","interestRate":"4.5%","status":"active"},{"id":"PRD-002","name":"54Current","type":"current","interestRate":"0%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/rates/base", (_req: Request, res: Response) => {
    const items = [{"id":"RATE-001","name":"Savings Rate","rate":"4.5%","status":"active"},{"id":"RATE-002","name":"Prime Lending Rate","rate":"18%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/reconciliation/runs", (_req: Request, res: Response) => {
    const items = [{"id":"REC-001","name":"NIBSS Recon \u2014 May 14","matched":"99.9%","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/risk-scoring/v1/risk/assessments", (_req: Request, res: Response) => {
    const items = [{"id":"RSK-001","name":"Credit Risk \u2014 Emeka Industries","type":"credit","score":72,"grade":"BB+","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/salary/v1/salary/batches", (_req: Request, res: Response) => {
    const items = [{"id":"SAL-001","name":"May 2026 Salary","employees":450,"totalAmount":"\u20a6285M","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/scf/invoices", (_req: Request, res: Response) => {
    const items = [{"id":"SCF-001","name":"SCF \u2014 Dangote","type":"invoice_discounting","invoiceValue":"\u20a6890M","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/search/indices", (_req: Request, res: Response) => {
    const items = [{"id":"SRCH-001","name":"Customer Search","documents":"25,400","sizeGB":"2.4","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/securities/list", (_req: Request, res: Response) => {
    const items = [{"id":"SEC-001","name":"FGN Bond 2031","type":"government_bond","faceValue":"\u20a645B","ytm":"15.2%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/sms-email-gateway/v1/messaging/deliveries", (_req: Request, res: Response) => {
    const items = [{"id":"MSG-001","name":"SMS \u2014 May 14","type":"sms","sent":125000,"delivered":124500,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/streams/topics", (_req: Request, res: Response) => {
    const items = [{"id":"STR-001","name":"transaction-stream","partitions":12,"throughput":"8,500 msg/s","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/trade-finance/lcs", (_req: Request, res: Response) => {
    const items = [{"id":"LC-001","name":"Import LC \u2014 Machinery","type":"irrevocable","amount":"\u20ac2.5M","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/treasury/investments", (_req: Request, res: Response) => {
    const items = [{"id":"TINV-001","name":"FGN Bond Portfolio","type":"government_bond","value":"\u20a685B","yield":"14.8%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/treasury/v1/treasury/fx-positions", (_req: Request, res: Response) => {
    const items = [{"id":"FXP-001","name":"USD Long","currency":"USD","amount":"$28.5M","unrealizedPnl":"\u20a61.14B","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/platform/virtual-accounts/accounts", (_req: Request, res: Response) => {
    const items = [{"id":"VA-001","name":"Collections VA \u2014 Shoprite","type":"collections","balance":"\u20a612.4M","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/accessibility/config", (_req: Request, res: Response) => {
    const items = [{"id":"A11Y-001","name":"WCAG 2.1 AA","score":"92%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/api-versioning/config", (_req: Request, res: Response) => {
    const items = [{"id":"VER-001","name":"API v1","version":"v1","routes":1150,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/apm-sentry/config", (_req: Request, res: Response) => {
    const items = [{"id":"APM-001","name":"Sentry Error Tracking","errorsToday":12,"p99Latency":"45ms","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/auth-enforcer/policies", (_req: Request, res: Response) => {
    const items = [{"id":"AUTH-001","name":"JWT Token Policy","algorithm":"RS256","expiry":"1h","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/backup-manager/config", (_req: Request, res: Response) => {
    const items = [{"id":"BKP-001","name":"Daily DB Backup","frequency":"daily","retention":"30 days","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/changelog/config", (_req: Request, res: Response) => {
    const items = [{"id":"CHG-001","name":"API Changelog v2.4.0","version":"2.4.0","entries":12,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/connection-pool/config", (_req: Request, res: Response) => {
    const items = [{"id":"POOL-001","name":"PostgreSQL Pool","maxConnections":500,"active":125,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/contract-tests/results", (_req: Request, res: Response) => {
    const items = [{"id":"CT-001","name":"Contract Tests","total":245,"passed":243,"failed":2,"status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/cors-gateway/policy", (_req: Request, res: Response) => {
    const items = [{"id":"CORS-001","name":"CORS Policy","origins":"*.54bank.ng","methods":"GET,POST,PUT,DELETE","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/db-migrations/list", (_req: Request, res: Response) => {
    const items = [{"id":"DBM-001","name":"Migration 045","applied":"2026-05-10","tables":15,"status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/e2e-tests/results", (_req: Request, res: Response) => {
    const items = [{"id":"E2E-001","name":"E2E Tests","total":89,"passed":87,"failed":2,"status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/i18n/config", (_req: Request, res: Response) => {
    const items = [{"id":"I18N-001","name":"English","lang":"en","completion":"100%","status":"active"},{"id":"I18N-002","name":"Hausa","lang":"ha","completion":"95%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/load-tests/results", (_req: Request, res: Response) => {
    const items = [{"id":"LOAD-001","name":"10K Concurrent","rps":12000,"p99":"45ms","errorRate":"0.02%","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/otel-collector/config", (_req: Request, res: Response) => {
    const items = [{"id":"OTEL-001","name":"OpenTelemetry","exporters":"prometheus,jaeger","samplingRate":"10%","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/request-validator/schemas", (_req: Request, res: Response) => {
    const items = [{"id":"RVAL-001","name":"Transfer Schema","endpoint":"POST /api/transfers","validations":12,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/secrets-rotation/config", (_req: Request, res: Response) => {
    const items = [{"id":"SROT-001","name":"DB Password Rotation","frequency":"90 days","nextRotation":"2026-07-14","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/production/unit-tests/results", (_req: Request, res: Response) => {
    const items = [{"id":"UT-001","name":"Unit Tests","total":1245,"passed":1240,"coverage":"84%","status":"completed"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/resilience/dashboard", (_req: Request, res: Response) => {
    const items = [{"id":"RES-001","name":"Circuit Breaker \u2014 Payments","type":"circuit_breaker","state":"closed","status":"healthy"},{"id":"RES-002","name":"Retry \u2014 NIBSS","type":"retry","maxRetries":3,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/security/api-keys", (_req: Request, res: Response) => {
    const items = [{"id":"KEY-001","name":"Mobile App Key","prefix":"54B-MOB-***","requests":"1.2M/day","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/security/audit/events", (_req: Request, res: Response) => {
    const items = [{"id":"AUD-001","name":"Login \u2014 Admin","type":"auth","ip":"10.0.1.45","result":"success","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/security/certificates", (_req: Request, res: Response) => {
    const items = [{"id":"CERT-001","name":"*.54bank.ng SSL","issuer":"DigiCert","expiry":"2027-03-15","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/security/encryption/policies", (_req: Request, res: Response) => {
    const items = [{"id":"ENC-001","name":"AES-256-GCM at Rest","type":"symmetric","algorithm":"AES-256-GCM","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/security/otp/policies", (_req: Request, res: Response) => {
    const items = [{"id":"OTP-001","name":"Transaction OTP","length":6,"expiry":"5 min","maxAttempts":3,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/security/pin-blocks", (_req: Request, res: Response) => {
    const items = [{"id":"PIN-001","name":"ISO 9564 Format 0","format":"format_0","algorithm":"3DES","status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/security/rate-limits/policies", (_req: Request, res: Response) => {
    const items = [{"id":"RL-001","name":"API Rate Limit","limit":"10,000 req/min","burst":500,"status":"active"}];
    res.json({ items, total: items.length });
  });
  app.get("/api/security/sessions", (_req: Request, res: Response) => {
    const items = [{"id":"SES-001","name":"Web Sessions","active":12450,"maxConcurrent":50000,"avgDuration":"25min","status":"active"}];
    res.json({ items, total: items.length });
  });
}
