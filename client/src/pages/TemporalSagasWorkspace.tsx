import { GitBranch } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "temporal-sagas",
  title: "Temporal Saga Workflows",
  subtitle: "Multi-step distributed transactions with compensation logic — NIP, Loan, KYC, EOD sagas",
  icon: GitBranch,
  accentColor: "fuchsia",
  fields: [
    { key: "id", label: "Execution ID", type: "readonly" },
    { key: "sagaName", label: "Saga", type: "readonly" },
    { key: "status", label: "Status", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "Execution ID" },
    { key: "sagaName", label: "Saga" },
    { key: "status", label: "Status" },
    { key: "stepsCompleted", label: "Steps Done" },
    { key: "totalSteps", label: "Total Steps" },
    { key: "durationMs", label: "Duration (ms)" },
    { key: "error", label: "Error" },
  ],
  idField: "id",
  searchFields: ["id", "sagaName", "status"],
  apiBase: "/api/db/workflow-cases",
};

export default function TemporalSagasWorkspace() {
  return <CrudWorkspace config={config} />;
}
