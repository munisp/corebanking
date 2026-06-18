import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { CheckCircle } from "lucide-react";

const config: CrudConfig = {
  domainKey: "approval-workflows",
  title: "Approval Workflows",
  subtitle: "Tenant-specific maker-checker approval chains with SLA tracking, escalation, and delegation",
  icon: CheckCircle,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Chain ID", sortable: true },
    { key: "tenantId", label: "Tenant", sortable: true },
    { key: "name", label: "Workflow Name", sortable: true },
    { key: "entityType", label: "Entity Type", sortable: true },
    { key: "threshold", label: "Threshold (NGN)", sortable: true },
    { key: "slaHours", label: "SLA (Hours)", sortable: true },
    { key: "active", label: "Active", sortable: true },
  ],
  idField: "id",
  searchFields: ["id", "tenantId", "name", "entityType"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function ApprovalWorkflowWorkspace() {
  return <CrudWorkspace config={config} />;
}
