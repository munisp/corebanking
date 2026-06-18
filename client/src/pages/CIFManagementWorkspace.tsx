import { Users } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "cif-management",
  title: "CIF / Address Management",
  subtitle: "Centralized customer information file — BVN, addresses, contacts, KYC documents, relationships",
  icon: Users,
  accentColor: "lime",
  fields: [
    { key: "id", label: "CIF ID", type: "readonly" },
    { key: "firstName", label: "First Name", type: "text", required: true },
    { key: "lastName", label: "Last Name", type: "text", required: true },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
  ],
  columns: [
    { key: "id", label: "CIF ID" },
    { key: "bvn", label: "BVN" },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "phone", label: "Phone" },
    { key: "kycTier", label: "KYC Tier" },
    { key: "status", label: "Status" },
    { key: "accountCount", label: "Accounts" },
  ],
  idField: "id",
  searchFields: ["id", "bvn", "firstName", "lastName", "phone"],
  apiBase: "/api/db/customers",
};

export default function CIFManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
