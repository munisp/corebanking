/**
 * Account dormancy management — CBN dormancy rules, reactivation workflow,
 * unclaimed balance reporting, and regulatory notification.
 */

export interface DormantAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: "savings" | "current" | "domiciliary";
  balance: number;
  currency: string;
  lastTransactionDate: string;
  dormancySince: string;
  dormancyStage: "inactive" | "dormant" | "unclaimed";
  daysInactive: number;
  branch: string;
  notificationsSent: number;
  lastNotificationDate?: string;
  reactivationEligible: boolean;
}

const dormantAccounts: DormantAccount[] = [
  { id: "DA-001", accountNumber: "5400100001", accountName: "Musa Aliyu", accountType: "savings", balance: 45_000, currency: "NGN", lastTransactionDate: "2025-08-15", dormancySince: "2026-02-15", dormancyStage: "inactive", daysInactive: 267, branch: "Abuja Main", notificationsSent: 2, lastNotificationDate: "2026-04-15", reactivationEligible: true },
  { id: "DA-002", accountNumber: "5400200015", accountName: "Grace Okafor", accountType: "current", balance: 2_350_000, currency: "NGN", lastTransactionDate: "2024-11-20", dormancySince: "2025-05-20", dormancyStage: "dormant", daysInactive: 536, branch: "Lagos Island", notificationsSent: 4, lastNotificationDate: "2026-03-20", reactivationEligible: true },
  { id: "DA-003", accountNumber: "5400300042", accountName: "Bashir Yusuf", accountType: "savings", balance: 890_000, currency: "NGN", lastTransactionDate: "2023-06-10", dormancySince: "2023-12-10", dormancyStage: "unclaimed", daysInactive: 1065, branch: "Kano Central", notificationsSent: 6, lastNotificationDate: "2025-12-10", reactivationEligible: false },
  { id: "DA-004", accountNumber: "5400400088", accountName: "Chioma Eze", accountType: "domiciliary", balance: 5_200, currency: "USD", lastTransactionDate: "2025-03-01", dormancySince: "2025-09-01", dormancyStage: "inactive", daysInactive: 251, branch: "Port Harcourt", notificationsSent: 1, lastNotificationDate: "2026-01-01", reactivationEligible: true },
  { id: "DA-005", accountNumber: "5400500123", accountName: "Adamu Bello", accountType: "savings", balance: 12_500, currency: "NGN", lastTransactionDate: "2024-01-15", dormancySince: "2024-07-15", dormancyStage: "dormant", daysInactive: 664, branch: "Kaduna", notificationsSent: 3, lastNotificationDate: "2025-07-15", reactivationEligible: true },
];

export function getDormantAccounts() { return dormantAccounts; }

export function getDormancyStats() {
  const byStage = { inactive: 0, dormant: 0, unclaimed: 0 };
  let totalBalance = 0;
  for (const a of dormantAccounts) {
    byStage[a.dormancyStage]++;
    if (a.currency === "NGN") totalBalance += a.balance;
  }
  return { total: dormantAccounts.length, byStage, totalNGNBalance: totalBalance };
}
