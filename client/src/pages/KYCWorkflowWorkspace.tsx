import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { PlayCircle } from "lucide-react";
const config: CrudConfig = {
  domainKey: "kyc-workflow", title: "KYC Workflow Orchestration",
  subtitle: "Visual workflow builder for KYC/KYB processes, SLA tracking, auto-assignment, escalation rules, Temporal-powered long-running workflows.",
  icon: PlayCircle, accentColor: "orange",
  fields: [],
  columns: [{ key: "id", label: "ID" }, { key: "name", label: "Workflow" }, { key: "status", label: "Status" }],
  idField: "id", statusField: "status", searchFields: ["name"],
  apiBase: "/api/db/kyc-data-quality-metrics",
};
export default function KYCWorkflowWorkspace() { return <CrudWorkspace config={config} />; }
