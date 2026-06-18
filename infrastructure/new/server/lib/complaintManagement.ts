/**
 * Customer complaints/feedback engine — CBN complaint resolution timelines,
 * categorization, SLA tracking, escalation, NPS scoring.
 */

export interface Complaint {
  id: string;
  customerId: string;
  customerName: string;
  category: "transaction" | "card" | "loan" | "account" | "service" | "fraud" | "charges" | "digital_channel";
  subject: string;
  description: string;
  channel: "branch" | "call_center" | "email" | "mobile_app" | "social_media" | "cbn_portal";
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "awaiting_customer" | "escalated" | "resolved" | "closed";
  assignedTo: string;
  branch: string;
  slaHours: number;
  hoursElapsed: number;
  slaBreach: boolean;
  resolution?: string;
  npsScore?: number;
  createdAt: string;
  updatedAt: string;
}

const complaints: Complaint[] = [
  { id: "CMP-001", customerId: "CUST-001", customerName: "Aisha Mohammed", category: "transaction", subject: "Failed NIP transfer — ₦500,000 debited but not credited", description: "Transfer to GTBank account 0123456789 failed but amount was debited from my account", channel: "mobile_app", priority: "high", status: "in_progress", assignedTo: "Ops Team A", branch: "Lagos Island", slaHours: 24, hoursElapsed: 8, slaBreach: false, createdAt: "2026-05-09T06:00:00Z", updatedAt: "2026-05-09T14:00:00Z" },
  { id: "CMP-002", customerId: "CUST-005", customerName: "Fatimah Abdullahi", category: "card", subject: "Unauthorized ATM withdrawal — ₦100,000", description: "ATM withdrawal at Kano mall I did not authorize. Card was in my possession.", channel: "call_center", priority: "critical", status: "escalated", assignedTo: "Fraud Unit", branch: "Kano Central", slaHours: 4, hoursElapsed: 6, slaBreach: true, createdAt: "2026-05-09T08:00:00Z", updatedAt: "2026-05-09T14:00:00Z" },
  { id: "CMP-003", customerId: "CUST-002", customerName: "Ibrahim Musa", category: "charges", subject: "Unexplained SMS charges — ₦16,000 YTD", description: "I am being charged N4 per SMS but never opted in for SMS alerts", channel: "email", priority: "medium", status: "awaiting_customer", assignedTo: "Digital Banking", branch: "Abuja Main", slaHours: 48, hoursElapsed: 20, slaBreach: false, resolution: "Awaiting customer confirmation to switch to push notifications", createdAt: "2026-05-08T10:00:00Z", updatedAt: "2026-05-09T06:00:00Z" },
  { id: "CMP-004", customerId: "CUST-010", customerName: "Pinnacle Holdings Ltd", category: "loan", subject: "Incorrect interest calculation on term loan", description: "Interest charged at 24% instead of agreed 22% on N400M facility", channel: "branch", priority: "high", status: "in_progress", assignedTo: "Credit Admin", branch: "Victoria Island", slaHours: 72, hoursElapsed: 48, slaBreach: false, createdAt: "2026-05-07T09:00:00Z", updatedAt: "2026-05-09T09:00:00Z" },
  { id: "CMP-005", customerId: "CUST-015", customerName: "Amara Okonkwo", category: "digital_channel", subject: "Mobile app login failure since app update", description: "Cannot login to mobile app after updating to v4.2. Biometric and PIN both fail.", channel: "social_media", priority: "medium", status: "open", assignedTo: "IT Support", branch: "Enugu", slaHours: 24, hoursElapsed: 4, slaBreach: false, createdAt: "2026-05-09T10:00:00Z", updatedAt: "2026-05-09T10:00:00Z" },
  { id: "CMP-006", customerId: "CUST-001", customerName: "Aisha Mohammed", category: "account", subject: "BVN update request taking too long", description: "Submitted BVN update form 3 weeks ago, still not processed", channel: "branch", priority: "low", status: "resolved", assignedTo: "Account Services", branch: "Lagos Island", slaHours: 168, hoursElapsed: 120, slaBreach: false, resolution: "BVN updated successfully. Customer notified.", npsScore: 7, createdAt: "2026-04-18T11:00:00Z", updatedAt: "2026-04-23T11:00:00Z" },
  { id: "CMP-007", customerId: "CUST-020", customerName: "Olusegun Bakare", category: "fraud", subject: "Phishing — account compromised, ₦2.3M transferred", description: "Received fake email, entered credentials. Three transfers totaling ₦2.3M to unknown accounts.", channel: "cbn_portal", priority: "critical", status: "escalated", assignedTo: "Fraud Unit", branch: "Ikeja", slaHours: 4, hoursElapsed: 2, slaBreach: false, createdAt: "2026-05-09T12:00:00Z", updatedAt: "2026-05-09T14:00:00Z" },
];

export function getComplaints() { return complaints; }

export function getComplaintStats() {
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let slaBreaches = 0;
  let resolved = 0;
  let totalNPS = 0;
  let npsCount = 0;
  for (const c of complaints) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;
    if (c.slaBreach) slaBreaches++;
    if (c.status === "resolved" || c.status === "closed") resolved++;
    if (c.npsScore !== undefined) { totalNPS += c.npsScore; npsCount++; }
  }
  return { total: complaints.length, slaBreaches, resolutionRate: Math.round((resolved / complaints.length) * 100), avgNPS: npsCount > 0 ? Math.round((totalNPS / npsCount) * 10) / 10 : 0, byStatus, byCategory, byPriority };
}
