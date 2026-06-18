import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldAlert } from "lucide-react";

const config: CrudConfig = {
  domainKey: "kyc-overrides",
  title: "KYC Overrides & Exceptions",
  subtitle: "Admin overrides for KYC requirements — waive liveness, extend expiry, escalate, approve/reject with maker-checker",
  icon: ShieldAlert,
  accentColor: "orange",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "customerName", label: "Customer Name", type: "text", required: true },
    { key: "overrideType", label: "Override Type", type: "select", options: ["approve", "reject", "escalate", "waive_liveness", "waive_document", "extend_expiry"] },
    { key: "reason", label: "Reason", type: "text", required: true },
    { key: "approvedBy", label: "Approved By", type: "text", required: true },
  ],
  columns: [
    { key: "id", label: "Override ID", sortable: true },
    { key: "customerName", label: "Customer", sortable: true },
    { key: "overrideType", label: "Type", sortable: true },
    { key: "reason", label: "Reason" },
    { key: "approvedBy", label: "Approved By" },
    { key: "status", label: "Status", sortable: true },
    { key: "expiresAt", label: "Expires At" },
    { key: "createdAt", label: "Created At", sortable: true },
  ],
  idField: "id",
  statusField: "status",
  searchFields: ["customerName", "customerId", "overrideType", "reason", "approvedBy"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
  actions: [
    { label: "Revoke", key: "revoke", condition: (r) => r.status === "active" },
  ],
};

export default function KYCOverridesWorkspace() {
  return <CrudWorkspace config={config} />;
}
