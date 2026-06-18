import { UserPlus } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "account-opening",
  title: "Account Opening",
  subtitle: "Account applications, product selection, KYC verification, tier-based limits",
  icon: UserPlus,
  accentColor: "bg-teal-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "fullName", "bvn", "accountNumber", "productType"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "fullName", label: "Full Name", type: "text", required: true },
    { key: "productType", label: "Product Type", type: "select", options: ["savings", "current", "domiciliary", "corporate", "joint", "minor"], required: true },
    { key: "bvn", label: "BVN (11 digits)", type: "text", required: true },
    { key: "nin", label: "NIN", type: "text" },
    { key: "phoneNumber", label: "Phone Number", type: "text", required: true },
    { key: "email", label: "Email", type: "text" },
    { key: "dateOfBirth", label: "Date of Birth", type: "text" },
    { key: "address", label: "Address", type: "text" },
    { key: "tier", label: "Account Tier", type: "select", options: ["tier1", "tier2", "tier3"], defaultValue: "tier1" },
  ],
  columns: [
    { key: "id", label: "App ID" },
    { key: "fullName", label: "Name" },
    { key: "productType", label: "Product" },
    { key: "accountNumber", label: "Account No" },
    { key: "tier", label: "Tier" },
    { key: "dailyLimit", label: "Daily Limit", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Verify KYC", key: "kyc_verify", condition: (r) => r.status === "kyc_pending" },
    { label: "Approve", key: "approve", condition: (r) => r.status === "kyc_verified" },
    { label: "Reject", key: "reject", condition: (r) => r.status !== "active" && r.status !== "rejected" },
  ],
};

export default function AccountOpeningWorkspace() {
  return <CrudWorkspace config={config} />;
}
