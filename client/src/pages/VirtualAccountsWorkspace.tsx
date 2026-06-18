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
  searchFields: ["accountName", "accountNumber", "accountId", "customerId"],
  apiBase: "/api/db/virtual-accounts",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "accountName", label: "Account Name", type: "text", required: true, placeholder: "e.g. Collections Account" },
    { key: "bankCode", label: "Bank Code", type: "text", defaultValue: "054" },
  ],
  columns: [
    { key: "accountId", label: "Account ID" },
    { key: "accountName", label: "Name" },
    { key: "accountNumber", label: "Account No." },
    { key: "balance", label: "Balance", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "availableBalance", label: "Available", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "holdAmount", label: "On Hold", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Freeze", key: "freeze", condition: (r) => r.status === "active" },
    { label: "Unfreeze", key: "unfreeze", condition: (r) => r.status === "frozen" },
    { label: "Close", key: "close", condition: (r) => Number(r.balance) === 0 },
  ],
};

export default function VirtualAccountsWorkspace() {
  return <CrudWorkspace config={config} />;
}
