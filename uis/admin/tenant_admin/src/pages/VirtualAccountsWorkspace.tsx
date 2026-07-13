import { Landmark } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "virtual-accounts",
  title: "Virtual Accounts",
  subtitle: "VAN issuance, collections, holds, and settlement controls",
  icon: Landmark,
  accentColor: "bg-cyan-600",
  idField: "id",
  statusField: "status",
  responseKey: "accounts",
  searchFields: ["account_name", "van", "id", "customer_id"],
  apiBase: "/virtual-account/api/v1/virtual-accounts",
  listApi: "/virtual-account/api/v1/virtual-accounts/search",
  fields: [
    {
      key: "parent_account_id",
      label: "Parent Account",
      type: "api-select",
      required: true,
      optionsApi: "/account/account/all",
      optionLabel: "name",
      optionSecondaryLabel: "account_number",
      optionValue: "id",
      placeholder: "Select account to link...",
    },
    {
      key: "purpose",
      label: "Purpose",
      type: "select",
      required: true,
      options: ["merchant", "loan_collection", "escrow", "agent", "payroll", "general"],
      defaultValue: "merchant",
    },
    { key: "account_name", label: "Account Name", type: "text", required: true, placeholder: "e.g. Merchant Collections — Acme Ltd" },
    { key: "webhook_url", label: "Webhook URL", type: "text", placeholder: "https://yourdomain.com/webhook" },
    { key: "single_use", label: "Single Use (closes after first payment)", type: "boolean" },
  ],
  columns: [
    { key: "id", label: "VAN ID" },
    { key: "account_name", label: "Name" },
    { key: "van", label: "Account No." },
    { key: "purpose", label: "Purpose" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Freeze", key: "freeze", method: "PUT", pathField: "van", path: ":id/status", body: { status: "suspended" }, condition: (r) => r.status === "active" },
    { label: "Unfreeze", key: "unfreeze", method: "PUT", pathField: "van", path: ":id/status", body: { status: "active" }, condition: (r) => r.status === "suspended" },
    { label: "Close", key: "close", method: "PUT", pathField: "van", path: ":id/status", body: { status: "closed" }, condition: (r) => Number(r.balance) === 0 },
  ],
};

export default function VirtualAccountsWorkspace() {
  return <CrudWorkspace config={config} />;
}
