/**
 * Interest accrual engine — daily accrual computation for savings, loans, FDs.
 * Supports 365-day and 360-day year conventions, tiered interest rates.
 */

export interface AccrualRecord {
  id: string;
  accountNumber: string;
  accountName: string;
  productType: "savings" | "current" | "fixed_deposit" | "loan" | "overdraft";
  principal: number;
  annualRate: number;
  accrualBasis: "365" | "360";
  dailyAccrual: number;
  mtdAccrual: number;
  ytdAccrual: number;
  lastAccrualDate: string;
  currency: string;
  status: "active" | "suspended" | "matured";
}

const accrualRecords: AccrualRecord[] = [
  { id: "IA-001", accountNumber: "5400001234", accountName: "Aisha Mohammed", productType: "savings", principal: 5_000_000, annualRate: 4.5, accrualBasis: "365", dailyAccrual: 616.44, mtdAccrual: 5_547.95, ytdAccrual: 29_178.08, lastAccrualDate: "2026-05-09", currency: "NGN", status: "active" },
  { id: "IA-002", accountNumber: "5400005678", accountName: "Ibrahim Musa", productType: "fixed_deposit", principal: 50_000_000, annualRate: 12.0, accrualBasis: "365", dailyAccrual: 16_438.36, mtdAccrual: 147_945.21, ytdAccrual: 778_356.16, lastAccrualDate: "2026-05-09", currency: "NGN", status: "active" },
  { id: "IA-003", accountNumber: "5400009012", accountName: "Zenith Construction Ltd", productType: "loan", principal: 250_000_000, annualRate: 22.0, accrualBasis: "360", dailyAccrual: 152_777.78, mtdAccrual: 1_375_000.00, ytdAccrual: 7_236_111.11, lastAccrualDate: "2026-05-09", currency: "NGN", status: "active" },
  { id: "IA-004", accountNumber: "5400003456", accountName: "Chukwuemeka Obi", productType: "overdraft", principal: 15_000_000, annualRate: 28.0, accrualBasis: "365", dailyAccrual: 11_506.85, mtdAccrual: 103_561.64, ytdAccrual: 545_205.48, lastAccrualDate: "2026-05-09", currency: "NGN", status: "active" },
  { id: "IA-005", accountNumber: "5400007890", accountName: "Fatimah Abdullahi", productType: "savings", principal: 1_200_000, annualRate: 3.75, accrualBasis: "365", dailyAccrual: 123.29, mtdAccrual: 1_109.59, ytdAccrual: 5_838.36, lastAccrualDate: "2026-05-09", currency: "NGN", status: "active" },
  { id: "IA-006", accountNumber: "5400006543", accountName: "Oluwaseun Adebayo", productType: "fixed_deposit", principal: 100_000_000, annualRate: 14.5, accrualBasis: "365", dailyAccrual: 39_726.03, mtdAccrual: 357_534.25, ytdAccrual: 1_881_506.85, lastAccrualDate: "2026-05-09", currency: "NGN", status: "matured" },
];

export function getAccrualRecords() { return accrualRecords; }

export function computeDailyAccrual(principal: number, annualRate: number, basis: "365" | "360"): number {
  const days = basis === "365" ? 365 : 360;
  return Math.round((principal * annualRate / 100 / days) * 100) / 100;
}
