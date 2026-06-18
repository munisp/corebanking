import { Clock } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "standing-orders",
  title: "Standing Orders & Mandates",
  subtitle: "Scheduled payments, recurring transfers, direct debit mandates",
  icon: Clock,
  accentColor: "bg-indigo-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "accountId", "beneficiaryName", "frequency"],
  apiBase: "/api/db/transfers",
  fields: [
    { key: "accountId", label: "Account ID", type: "text", required: true },
    { key: "beneficiaryId", label: "Beneficiary ID", type: "text" },
    { key: "beneficiaryName", label: "Beneficiary Name", type: "text" },
    { key: "amount", label: "Amount (₦)", type: "number", required: true },
    { key: "frequency", label: "Frequency", type: "select", options: ["daily", "weekly", "biweekly", "monthly", "quarterly", "annually"], required: true },
    { key: "startDate", label: "Start Date", type: "text" },
    { key: "endDate", label: "End Date", type: "text" },
    { key: "narration", label: "Narration", type: "text" },
  ],
  columns: [
    { key: "id", label: "Order ID" },
    { key: "accountId", label: "Account" },
    { key: "beneficiaryName", label: "Beneficiary" },
    { key: "amount", label: "Amount", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "frequency", label: "Frequency" },
    { key: "nextExecutionAt", label: "Next Execution" },
    { key: "executionCount", label: "Runs" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Pause", key: "pause", condition: (r) => r.status === "active" },
    { label: "Resume", key: "resume", condition: (r) => r.status === "paused" },
    { label: "Cancel", key: "cancel", condition: (r) => r.status !== "cancelled" && r.status !== "completed" },
  ],
};

export default function StandingOrdersWorkspace() {
  return <CrudWorkspace config={config} />;
}
