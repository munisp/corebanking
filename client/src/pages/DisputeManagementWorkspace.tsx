import { AlertTriangle } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "dispute-management",
  title: "Dispute Cases",
  subtitle: "Transaction disputes, chargebacks, fraud investigation, and resolution tracking",
  icon: AlertTriangle,
  accentColor: "bg-red-600",
  idField: "id",
  statusField: "status",
  searchFields: ["caseId", "customerId", "category", "description"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "transactionId", label: "Transaction ID", type: "text", required: true },
    { key: "category", label: "Category", type: "select", options: [
      "unauthorized_transaction", "merchant_dispute", "atm_failure", "card_fraud",
      "service_not_rendered", "duplicate_charge", "wrong_amount", "account_takeover", "phishing"
    ], required: true },
    { key: "channel", label: "Channel", type: "select", options: ["card", "mobile", "internet", "pos", "atm"], required: true },
    { key: "amount", label: "Amount (₦)", type: "number", required: true },
    { key: "description", label: "Description", type: "textarea", required: true },
  ],
  columns: [
    { key: "caseId", label: "Case ID" },
    { key: "category", label: "Category", render: (v) => String(v).replace(/_/g, " ") },
    { key: "channel", label: "Channel" },
    { key: "disputedAmount", label: "Amount", render: (v, row) => {
      const amt = Number(v ?? row.transactionAmount ?? row.amount ?? 0);
      return isNaN(amt) ? "\u2014" : `\u20a6${amt.toLocaleString()}`;
    }},
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Investigate", key: "investigate", condition: (r) => r.status === "open" },
    { label: "Resolve", key: "resolve", condition: (r) => r.status === "investigating" },
    { label: "Chargeback", key: "chargeback", condition: (r) => r.channel === "card" && r.status !== "resolved" },
  ],
};

export default function DisputeManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
