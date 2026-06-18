import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";
const config: CrudConfig = {
  domainKey: "credit-scoring", title: "Credit Scoring",
  subtitle: "ML-powered credit risk scoring for Nigerian banking customers.",
  icon: TrendingUp, accentColor: "red",
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
export default function CreditScoringWorkspace() { return <CrudWorkspace config={config} />; }
