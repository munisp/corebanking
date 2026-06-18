import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { PlayCircle } from "lucide-react";
const config: CrudConfig = {
  domainKey: "e2e-orchestrator", title: "E2E Orchestrator",
  subtitle: "Playwright — 24 flows covering onboarding, transfers, loans, KYC, FX, GL, Mojaloop.",
  icon: PlayCircle, accentColor: "indigo",
  fields: [
    { key: "id", label: "ID", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["active", "inactive", "pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/anomaly-models",
};
export default function E2EOrchestratorWorkspace() { return <CrudWorkspace config={config} />; }
