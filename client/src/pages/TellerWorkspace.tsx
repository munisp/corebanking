import { Landmark } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "teller-operations",
  title: "Teller Sessions",
  subtitle: "Branch teller operations — cash management, deposits, withdrawals, vault control",
  icon: Landmark,
  accentColor: "bg-blue-700",
  idField: "id",
  statusField: "status",
  searchFields: ["sessionId", "tellerId", "branchCode"],
  apiBase: "/api/db/teller-sessions",
  fields: [
    { key: "tellerId", label: "Teller ID", type: "text", required: true, placeholder: "e.g. TLR-101" },
    { key: "branchCode", label: "Branch Code", type: "text", required: true, placeholder: "e.g. LG001" },
    { key: "openingBalance", label: "Opening Balance (₦)", type: "number", required: true },
  ],
  columns: [
    { key: "sessionId", label: "Session ID" },
    { key: "tellerId", label: "Teller" },
    { key: "branchCode", label: "Branch" },
    { key: "openingBalance", label: "Opening", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "currentBalance", label: "Current", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Close", key: "close", condition: (r) => r.status === "open" },
    { label: "Suspend", key: "suspend", condition: (r) => r.status === "open" },
    { label: "Resume", key: "resume", condition: (r) => r.status === "suspended" },
  ],
};

export default function TellerWorkspace() {
  return <CrudWorkspace config={config} />;
}
