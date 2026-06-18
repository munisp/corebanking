import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "cooperative-credit-scoring",
  title: "Cooperative Credit Scoring",
  subtitle: "Aggregate cooperative health scoring for repayment and governance",
  icon: BarChart3,
  accentColor: "purple",
  apiBase: "/api/db/cooperative-credit-scoring",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "amount", label: "Score", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Type" },
    { key: "amount", label: "Score" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function CooperativeCreditScoringWorkspace() {
  return <CrudWorkspace config={config} />;
}
