/**
 * C2: Comprehensive Zod validation schemas for all platform API endpoints.
 * Every POST/PUT/PATCH route should use validateBody() with one of these schemas.
 */

import { z } from "zod";

// ── Common patterns ──
const bvn = z.string().regex(/^\d{11}$/, "BVN must be 11 digits");
const nin = z.string().regex(/^\d{11}$/, "NIN must be 11 digits").optional();
const phone = z.string().regex(/^\+234\d{10}$/, "Phone must be +234XXXXXXXXXX");
const accountNumber = z.string().regex(/^\d{10}$/, "Account number must be 10 digits");
const bankCode = z.string().regex(/^\d{3}$/, "Bank code must be 3 digits");
const currency = z.enum(["NGN", "USD", "GBP", "EUR", "CAD", "AED"]).default("NGN");
const positiveAmount = z.number().positive("Amount must be positive");

// ── Account Opening (A1) ──
export const accountApplicationSchema = z.object({
  customerId: z.string().min(1).max(50),
  productType: z.enum(["savings", "current", "domiciliary", "corporate", "joint", "minor"]),
  currency,
  tier: z.enum(["tier1", "tier2", "tier3"]),
  bvn,
  nin,
  fullName: z.string().min(2).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  phoneNumber: phone,
  email: z.string().email(),
  address: z.string().min(5).max(500),
  employerName: z.string().max(200).optional(),
  monthlyIncome: z.number().min(0).optional(),
});

// ── Beneficiary ──
export const beneficiarySchema = z.object({
  customerId: z.string().min(1),
  accountNumber: accountNumber,
  bankCode: bankCode,
  bankName: z.string().min(1).max(200),
  accountName: z.string().min(1).max(200),
  nickname: z.string().max(100).optional(),
  currency,
  category: z.string().max(50).optional(),
});

// ── Standing Order ──
export const standingOrderSchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(["recurring_transfer", "salary_sweep", "bill_payment"]),
  sourceAccount: accountNumber,
  destinationAccount: accountNumber,
  destinationBank: bankCode.optional(),
  amount: positiveAmount,
  currency,
  frequency: z.enum(["daily", "weekly", "bi_weekly", "monthly", "quarterly", "annually"]),
  description: z.string().max(200).optional(),
  nextExecutionDate: z.string().optional(),
});

// ── Savings Account ──
export const savingsAccountSchema = z.object({
  customerId: z.string().min(1),
  productType: z.enum(["regular", "fixed_deposit", "target_savings", "high_yield"]),
  currency,
  initialDeposit: positiveAmount,
  interestRate: z.number().min(0).max(100).optional(),
  tenorMonths: z.number().int().min(1).max(360).optional(),
  targetAmount: positiveAmount.optional(),
  targetDate: z.string().optional(),
  maturityAction: z.enum(["rollover", "payout", "reinvest"]).optional(),
});

// ── Card Management ──
export const cardSchema = z.object({
  customerId: z.string().min(1),
  cardType: z.enum(["debit", "credit", "prepaid"]),
  scheme: z.enum(["visa", "mastercard", "verve"]),
  currency,
  accountNumber: accountNumber.optional(),
  nameOnCard: z.string().min(1).max(50).optional(),
  dailyLimit: positiveAmount.optional(),
  posLimit: positiveAmount.optional(),
  webLimit: positiveAmount.optional(),
  creditLimit: positiveAmount.optional(),
});

// ── Payment (NIP) ──
export const nipPaymentSchema = z.object({
  sourceAccount: accountNumber,
  destinationAccount: accountNumber,
  destinationBank: bankCode,
  amount: positiveAmount,
  currency,
  narration: z.string().max(200).optional(),
  senderName: z.string().min(1).max(200),
  receiverName: z.string().min(1).max(200),
});

// ── Bill Payment ──
export const billPaymentSchema = z.object({
  customerId: z.string().min(1),
  billerCode: z.string().min(1).max(20),
  billerName: z.string().min(1).max(200),
  amount: positiveAmount,
  currency,
  meterNumber: z.string().max(50).optional(),
  customerReference: z.string().max(100).optional(),
});

// ── Trade Finance LC ──
export const lcSchema = z.object({
  applicant: z.string().min(1).max(200),
  beneficiary: z.string().min(1).max(200),
  amount: positiveAmount,
  currency,
  lcType: z.enum(["irrevocable", "revocable", "standby", "transferable"]),
  expiryDate: z.string(),
  goodsDescription: z.string().min(1).max(1000),
  portOfLoading: z.string().max(200).optional(),
  portOfDischarge: z.string().max(200).optional(),
  incoterms: z.string().max(10).optional(),
  advisingBank: z.string().max(200).optional(),
});

// ── Dispute ──
export const disputeSchema = z.object({
  customerId: z.string().min(1),
  transactionId: z.string().min(1),
  amount: positiveAmount,
  currency,
  category: z.enum(["unauthorized_transaction", "service_not_rendered", "duplicate_charge", "wrong_amount", "counterfeit_card", "atm_failure"]),
  channel: z.enum(["card", "transfer", "pos", "atm", "web", "mobile"]),
  merchantName: z.string().max(200).optional(),
  description: z.string().min(10).max(2000),
  cardLast4: z.string().regex(/^\d{4}$/).optional(),
});

// ── Education Loan ──
export const educationLoanSchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1).max(200),
  institution: z.string().min(1).max(200),
  program: z.string().min(1).max(200),
  amount: positiveAmount,
  currency,
  tenorMonths: z.number().int().min(6).max(120),
  interestRate: z.number().min(0).max(30),
  guarantorName: z.string().min(1).max(200),
  guarantorBVN: bvn,
  disbursementAccount: accountNumber,
});

// ── Mortgage ──
export const mortgageSchema = z.object({
  customerId: z.string().min(1),
  propertyAddress: z.string().min(5).max(500),
  propertyValue: positiveAmount,
  loanAmount: positiveAmount,
  interestRate: z.number().min(0).max(30),
  tenorYears: z.number().int().min(1).max(30),
  employerName: z.string().max(200).optional(),
  monthlyIncome: positiveAmount,
  monthlyExpenses: z.number().min(0),
  downPayment: positiveAmount,
  nhfEligible: z.boolean().optional(),
});

// ── Esusu Group ──
export const esusuGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  contributionAmount: positiveAmount,
  currency,
  frequency: z.enum(["weekly", "bi_weekly", "monthly"]),
  members: z.array(z.string()).min(3, "Esusu groups require at least 3 members"),
  maxMembers: z.number().int().min(3).max(50).optional(),
  startDate: z.string().optional(),
});

// ── Regulatory Report ──
export const regulatoryReportSchema = z.object({
  reportType: z.enum(["ctr", "ndic_returns", "aml_str", "car_report", "liquidity_report", "firs_vat", "basel_iii"]),
  title: z.string().min(1).max(200),
  period: z.string().min(1),
  status: z.enum(["draft", "pending_review", "submitted", "approved", "rejected"]).optional(),
  submittedTo: z.string().max(100).optional(),
});

// ── Diaspora Remittance ──
export const remittanceSchema = z.object({
  senderId: z.string().min(1),
  senderName: z.string().min(1).max(200),
  recipientName: z.string().min(1).max(200),
  recipientAccount: accountNumber,
  corridor: z.string().min(1).max(10),
  sourceAmount: positiveAmount,
});

// ── Interest Rate ──
export const baseRateSchema = z.object({
  name: z.string().min(1).max(200),
  rate: z.number().min(0).max(100),
  effectiveAt: z.string(),
  source: z.string().min(1).max(100),
  currency,
  status: z.enum(["active", "inactive"]).default("active"),
});

// ── Cheque ──
export const chequeSchema = z.object({
  chequeNumber: z.string().min(1).max(20),
  drawerAccount: accountNumber,
  payeeName: z.string().min(1).max(200),
  amount: positiveAmount,
  presentingBank: z.string().min(1).max(200),
});

// ── NIBSS Mandate ──
export const nibssMandateSchema = z.object({
  customerId: z.string().min(1),
  accountNumber: accountNumber,
  bankCode: bankCode,
  creditorName: z.string().min(1).max(200),
  creditorAccount: accountNumber,
  creditorBankCode: bankCode,
  maxAmount: positiveAmount,
  frequency: z.enum(["weekly", "monthly", "quarterly", "annually"]),
  startDate: z.string(),
  endDate: z.string().optional(),
});

// ── Notification ──
export const notificationSchema = z.object({
  customerId: z.string().min(1),
  channel: z.enum(["sms", "email", "push", "whatsapp", "in_app"]),
  templateId: z.string().max(100).optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
  deviceToken: z.string().optional(),
});

// ── FX Deal ──
export const fxDealSchema = z.object({
  dealType: z.enum(["spot", "forward", "swap"]),
  currencyPair: z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/, "Format: XXX/YYY"),
  buyAmount: positiveAmount,
  sellAmount: positiveAmount,
  rate: z.number().positive(),
  customerId: z.string().optional(),
  settlement: z.string().optional(),
  maturityDate: z.string().optional(),
});
