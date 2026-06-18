import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { PlayCircle } from "lucide-react";

const config: CrudConfig = {
  domainKey: "kyc-triggers",
  title: "KYC Triggers",
  subtitle: "Admin-initiated, event-driven, and scheduled KYC verification triggers with full pipeline tracking",
  icon: PlayCircle,
  accentColor: "emerald",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "customerName", label: "Customer Name", type: "text", required: true },
    { key: "priority", label: "Priority", type: "select", options: ["low", "normal", "high", "urgent"] },
    { key: "notes", label: "Notes", type: "text" },
  ],
  columns: [
    { key: "id", label: "Trigger ID", sortable: true },
    { key: "customerName", label: "Customer", sortable: true },
    { key: "triggerType", label: "Trigger Type", sortable: true },
    { key: "triggerSource", label: "Source", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "result", label: "Result", sortable: true },
    { key: "priority", label: "Priority", sortable: true },
    { key: "requestedBy", label: "Requested By" },
    { key: "requestedAt", label: "Requested At", sortable: true },
  ],
  idField: "id",
  statusField: "status",
  searchFields: ["customerName", "customerId", "triggerType", "status", "triggerSource"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
  actions: [
    { label: "Re-verify", key: "re-verify", condition: (r) => r.status === "completed" },
    { label: "Cancel", key: "cancel", condition: (r) => r.status === "pending" || r.status === "in_progress" },
  ],
};

export default function KYCTriggersWorkspace() {
  return <CrudWorkspace config={config} />;
}
