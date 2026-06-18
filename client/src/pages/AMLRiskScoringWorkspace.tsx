import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "aml-risk-scoring",
  title: "AML Risk Scoring Engine",
  subtitle: "Risk-based AML scoring with sanctions, PEP, adverse media factors",
  icon: Shield,
  accentColor: "red",
  apiBase: "/api/db/aml-risk-scores",
  idField: "id",
  statusField: "status",
  searchFields: ["customerId"],
  fields: [
    { key: "customerId", label: "Customer ID", type: "text" },
    { key: "customerName", label: "Customer", type: "text" },
    { key: "riskScore", label: "Risk Score", type: "number" },
    { key: "riskLevel", label: "Level", type: "text" },
    { key: "cddLevel", label: "CDD Level", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "customerId", label: "Customer ID" },
    { key: "customerName", label: "Customer" },
    { key: "riskScore", label: "Risk Score" },
    { key: "riskLevel", label: "Level" },
    { key: "cddLevel", label: "CDD Level" },
    { key: "status", label: "Status" }
  ],
};

export default function AMLRiskScoringWorkspace() {
  return <CrudWorkspace config={config} />;
}
