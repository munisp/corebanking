import { Users } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "beneficiary-management",
  title: "Beneficiary Management",
  subtitle: "Saved payees, name verification, transfer limits, bank directory",
  icon: Users,
  accentColor: "bg-cyan-600",
  idField: "id",
  statusField: "verified",
  searchFields: ["id", "name", "accountNumber", "bankName", "customerId"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "name", label: "Beneficiary Name", type: "text", required: true },
    { key: "nickname", label: "Nickname", type: "text" },
    { key: "bankCode", label: "Bank Code", type: "text", required: true },
    { key: "accountNumber", label: "Account Number (10 digits)", type: "text", required: true },
    { key: "accountType", label: "Account Type", type: "select", options: ["savings", "current", "domiciliary"] },
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "bankName", label: "Bank" },
    { key: "accountNumber", label: "Account No" },
    { key: "dailyLimit", label: "Daily Limit", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "txnCount", label: "Transactions" },
    { key: "isFavorite", label: "Favorite", render: (v) => v ? "★" : "" },
    { key: "verified", label: "Verified", render: (v) => v ? "Yes" : "Pending" },
  ],
  actions: [
    { label: "Verify", key: "verify", condition: (r) => !r.verified },
    { label: "Favorite", key: "toggle_favorite", condition: () => true },
    { label: "Set Limits", key: "set_limits", condition: () => true },
  ],
};

export default function BeneficiaryManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
