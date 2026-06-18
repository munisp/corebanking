import { GitBranch } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "workflow-engine",
  title: "Workflow Engine",
  subtitle: "Temporal-compatible saga orchestration — loan origination, LC lifecycle, dispute resolution",
  icon: GitBranch,
  accentColor: "bg-cyan-700",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "templateId", "entityId", "status"],
  apiBase: "/api/db/workflow-cases",
  fields: [
    { key: "templateId", label: "Workflow Template", type: "select", options: ["loan_origination", "lc_lifecycle", "dispute_resolution", "account_opening", "eod_processing"], required: true },
    { key: "entityId", label: "Entity ID", type: "text", required: true, placeholder: "e.g. LOAN-001, LC-042" },
    { key: "entityType", label: "Entity Type", type: "text", placeholder: "e.g. loan, lc, dispute" },
  ],
  columns: [
    { key: "id", label: "Workflow ID" },
    { key: "templateName", label: "Template" },
    { key: "entityId", label: "Entity" },
    { key: "currentStep", label: "Current Step" },
    { key: "stepIndex", label: "Progress", render: (v, row) => `${Number(v) + 1}/${row.totalSteps}` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Advance", key: "advance", condition: (r) => r.status === "running" },
    { label: "Cancel", key: "cancel", condition: (r) => r.status === "running" },
  ],
};

export default function WorkflowEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
