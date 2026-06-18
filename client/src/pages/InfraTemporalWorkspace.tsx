import { GitBranch } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "infra-temporal",
  title: "Temporal Workflows",
  subtitle: "Saga orchestration — payment, loan, KYC, FX, and trade finance workflows with compensation logic",
  icon: GitBranch,
  accentColor: "purple",
  fields: [
    { key: "id", label: "Workflow ID", type: "readonly" },
    { key: "name", label: "Workflow Name", type: "readonly" },
    { key: "taskQueue", label: "Task Queue", type: "readonly" },
    { key: "timeoutSeconds", label: "Timeout (s)", type: "readonly" },
    { key: "status", label: "Status", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Workflow" },
    { key: "taskQueue", label: "Queue" },
    { key: "timeoutSeconds", label: "Timeout" },
    { key: "status", label: "Status" },
  ],
  idField: "id",
  statusField: "status",
  searchFields: ["id", "name", "taskQueue"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function InfraTemporalWorkspace() {
  return <CrudWorkspace config={config} />;
}
