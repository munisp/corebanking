import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Briefcase } from "lucide-react";

const config: CrudConfig = {
  domainKey: "aml-case-manager",
  title: "AML Case Management",
  subtitle: "AML investigation workflow — alert triage to resolution",
  icon: Briefcase,
  accentColor: "purple",
  apiBase: "/api/db/aml-cases",
  idField: "id",
  statusField: "status",
  searchFields: ["customerId"],
  fields: [
    { key: "customerId", label: "Customer ID", type: "text" },
    { key: "customerName", label: "Customer", type: "text" },
    { key: "caseType", label: "Type", type: "text" },
    { key: "riskLevel", label: "Risk", type: "text" },
    { key: "status", label: "Status", type: "text" },
    { key: "assignedTo", label: "Assigned", type: "text" }
  ],
  columns: [
    { key: "customerId", label: "Customer ID" },
    { key: "customerName", label: "Customer" },
    { key: "caseType", label: "Type" },
    { key: "riskLevel", label: "Risk" },
    { key: "status", label: "Status" },
    { key: "assignedTo", label: "Assigned" }
  ],
};

export default function AMLCaseManagerWorkspace() {
  return <CrudWorkspace config={config} />;
}
