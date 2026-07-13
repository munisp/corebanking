/**
 * Product catalog — account products, loan products, card products, FX products.
 * CBN-approved product definitions with pricing, eligibility, features.
 */

export interface BankProduct {
  id: string;
  name: string;
  category: "deposit" | "loan" | "card" | "fx" | "investment" | "insurance" | "digital";
  subcategory: string;
  description: string;
  currency: string;
  minAmount: number;
  maxAmount: number;
  interestRate?: number;
  fees: { name: string; amount: number; type: "flat" | "percentage" }[];
  eligibility: string[];
  features: string[];
  kycTier: "Tier 1" | "Tier 2" | "Tier 3" | "Corporate";
  status: "active" | "suspended" | "deprecated" | "pilot";
  launchDate: string;
  customerCount: number;
}

const products: BankProduct[] = [
  { id: "PRD-001", name: "54Save Basic", category: "deposit", subcategory: "Savings", description: "Entry-level savings account with competitive interest", currency: "NGN", minAmount: 1_000, maxAmount: 50_000, interestRate: 4.5, fees: [{ name: "Maintenance", amount: 0, type: "flat" }], eligibility: ["BVN required", "18+ years"], features: ["Zero maintenance fee", "Mobile banking", "Debit card"], kycTier: "Tier 1", status: "active", launchDate: "2024-01-01", customerCount: 1_250_000 },
  { id: "PRD-002", name: "54Save Premium", category: "deposit", subcategory: "Savings", description: "Premium savings with higher interest and priority service", currency: "NGN", minAmount: 100_000, maxAmount: 1_000_000_000, interestRate: 6.5, fees: [{ name: "Maintenance", amount: 500, type: "flat" }], eligibility: ["BVN + NIN", "18+ years", "Min balance ₦100K"], features: ["Priority banking", "Dedicated RM", "Concierge"], kycTier: "Tier 3", status: "active", launchDate: "2024-03-01", customerCount: 85_000 },
  { id: "PRD-003", name: "54Current Business", category: "deposit", subcategory: "Current", description: "Business current account with overdraft facility", currency: "NGN", minAmount: 0, maxAmount: 0, interestRate: 0, fees: [{ name: "COT", amount: 0.05, type: "percentage" }, { name: "Maintenance", amount: 2_000, type: "flat" }], eligibility: ["CAC registration", "BVN + NIN of directors", "Board resolution"], features: ["Cheque book", "Internet banking", "Bulk payments", "Overdraft eligible"], kycTier: "Corporate", status: "active", launchDate: "2024-01-01", customerCount: 42_000 },
  { id: "PRD-004", name: "54Loan Personal", category: "loan", subcategory: "Consumer", description: "Unsecured personal loan up to ₦5M", currency: "NGN", minAmount: 50_000, maxAmount: 5_000_000, interestRate: 22.0, fees: [{ name: "Processing", amount: 1.5, type: "percentage" }, { name: "Insurance", amount: 0.5, type: "percentage" }], eligibility: ["Salary earner", "6+ months account history", "Min ₦100K monthly income"], features: ["Up to 36 months", "No collateral", "Quick disbursement"], kycTier: "Tier 2", status: "active", launchDate: "2024-06-01", customerCount: 28_000 },
  { id: "PRD-005", name: "54Mortgage Home", category: "loan", subcategory: "Mortgage", description: "NHF-backed residential mortgage up to ₦15M", currency: "NGN", minAmount: 2_000_000, maxAmount: 15_000_000, interestRate: 6.0, fees: [{ name: "Processing", amount: 1.0, type: "percentage" }, { name: "Legal", amount: 150_000, type: "flat" }, { name: "Valuation", amount: 50_000, type: "flat" }], eligibility: ["NHF contributor 6+ months", "21-54 years", "Employed"], features: ["Up to 30 years", "NHF rate 6%", "Property insurance included"], kycTier: "Tier 3", status: "active", launchDate: "2025-01-01", customerCount: 3_200 },
  { id: "PRD-006", name: "54Card Platinum Visa", category: "card", subcategory: "Credit Card", description: "Platinum Visa credit card with global acceptance", currency: "NGN", minAmount: 0, maxAmount: 10_000_000, interestRate: 2.5, fees: [{ name: "Annual", amount: 25_000, type: "flat" }, { name: "Foreign txn", amount: 1.5, type: "percentage" }], eligibility: ["Min ₦500K monthly income", "Tier 3 KYC", "Good credit score"], features: ["Airport lounge", "Purchase protection", "Travel insurance", "45-day interest-free"], kycTier: "Tier 3", status: "active", launchDate: "2025-03-01", customerCount: 15_000 },
  { id: "PRD-007", name: "54FX DomAccount", category: "fx", subcategory: "Domiciliary", description: "Multi-currency domiciliary account (USD/GBP/EUR)", currency: "USD", minAmount: 0, maxAmount: 0, fees: [{ name: "Maintenance", amount: 10, type: "flat" }], eligibility: ["BVN + NIN", "Valid international passport"], features: ["USD/GBP/EUR", "International wire", "Visa debit card"], kycTier: "Tier 3", status: "active", launchDate: "2024-01-01", customerCount: 22_000 },
  { id: "PRD-008", name: "54Invest T-Bills", category: "investment", subcategory: "Treasury Bills", description: "FGN T-Bill investment from ₦50K", currency: "NGN", minAmount: 50_000, maxAmount: 1_000_000_000, interestRate: 12.5, fees: [{ name: "Management", amount: 0.1, type: "percentage" }], eligibility: ["Any account holder", "Tier 2+ KYC"], features: ["91/182/364 day tenors", "Auto-rollover", "Discounted yield"], kycTier: "Tier 2", status: "active", launchDate: "2025-06-01", customerCount: 48_000 },
];

export function getProducts() { return products; }

export function getProductStats() {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalCustomers = 0;
  for (const p of products) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    totalCustomers += p.customerCount;
  }
  return { total: products.length, totalCustomers, byCategory, byStatus };
}
