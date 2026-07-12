/**
 * Staff/role management — employees, roles, permissions, branches, dual control.
 */

export interface StaffMember {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  branch: string;
  status: "active" | "suspended" | "on_leave" | "terminated";
  permissions: string[];
  lastLogin: string;
  mfaEnabled: boolean;
  supervisorId?: string;
}

const staff: StaffMember[] = [
  { id: "STF-001", employeeId: "E-1001", fullName: "Adebayo Ogundimu", email: "a.ogundimu@54bank.ng", role: "Branch Manager", department: "Retail Banking", branch: "Lagos Island", status: "active", permissions: ["account.create", "account.approve", "loan.approve", "teller.supervise", "report.generate"], lastLogin: "2026-05-09T08:00:00Z", mfaEnabled: true },
  { id: "STF-002", employeeId: "E-1002", fullName: "Halima Yusuf", email: "h.yusuf@54bank.ng", role: "Head Teller", department: "Operations", branch: "Lagos Island", status: "active", permissions: ["teller.cash_in", "teller.cash_out", "teller.vault_access", "teller.eod_reconcile"], lastLogin: "2026-05-09T07:30:00Z", mfaEnabled: true, supervisorId: "STF-001" },
  { id: "STF-003", employeeId: "E-1003", fullName: "Chinedu Okafor", email: "c.okafor@54bank.ng", role: "Teller", department: "Operations", branch: "Lagos Island", status: "active", permissions: ["teller.cash_in", "teller.cash_out"], lastLogin: "2026-05-09T07:45:00Z", mfaEnabled: true, supervisorId: "STF-002" },
  { id: "STF-004", employeeId: "E-2001", fullName: "Amina Bello", email: "a.bello@54bank.ng", role: "Credit Analyst", department: "Credit Risk", branch: "Head Office", status: "active", permissions: ["loan.assess", "loan.recommend", "credit_risk.view", "collateral.value"], lastLogin: "2026-05-09T09:00:00Z", mfaEnabled: true },
  { id: "STF-005", employeeId: "E-2002", fullName: "Oluwafemi Adeleke", email: "o.adeleke@54bank.ng", role: "Chief Risk Officer", department: "Risk Management", branch: "Head Office", status: "active", permissions: ["loan.approve", "loan.override", "credit_risk.view", "credit_risk.modify", "report.regulatory", "fraud.investigate"], lastLogin: "2026-05-09T08:30:00Z", mfaEnabled: true },
  { id: "STF-006", employeeId: "E-3001", fullName: "Nkechi Eze", email: "n.eze@54bank.ng", role: "Compliance Officer", department: "Compliance", branch: "Head Office", status: "active", permissions: ["aml.screen", "ctr.file", "sar.file", "report.regulatory", "audit.view"], lastLogin: "2026-05-09T08:15:00Z", mfaEnabled: true },
  { id: "STF-007", employeeId: "E-4001", fullName: "Babajide Fashola", email: "b.fashola@54bank.ng", role: "Treasury Dealer", department: "Treasury", branch: "Head Office", status: "active", permissions: ["fx.deal", "fx.position", "investment.trade", "interbank.borrow"], lastLogin: "2026-05-09T07:00:00Z", mfaEnabled: true },
  { id: "STF-008", employeeId: "E-5001", fullName: "Fatima Aliyu", email: "f.aliyu@54bank.ng", role: "Branch Manager", department: "Retail Banking", branch: "Kano Central", status: "on_leave", permissions: ["account.create", "account.approve", "loan.approve", "teller.supervise", "report.generate"], lastLogin: "2026-05-05T08:00:00Z", mfaEnabled: true },
];

export function getStaff() { return staff; }

export function getStaffStats() {
  const byRole: Record<string, number> = {};
  const byBranch: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const s of staff) {
    byRole[s.role] = (byRole[s.role] || 0) + 1;
    byBranch[s.branch] = (byBranch[s.branch] || 0) + 1;
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  }
  return { total: staff.length, mfaEnabled: staff.filter((s) => s.mfaEnabled).length, byRole, byBranch, byStatus };
}
