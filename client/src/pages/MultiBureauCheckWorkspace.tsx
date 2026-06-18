import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";
const config: CrudConfig = {
  domainKey: "multi-bureau-check", title: "Multi-Bureau Credit Verification",
  subtitle: "Parallel CRC + First Central credit bureau checks, FIRS TIN validation. Credit score aggregation, risk grade mapping, default history detection.",
  icon: FileText, accentColor: "teal",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "bureau", label: "Bureau", type: "select", options: ["CRC", "FirstCentral", "both"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "customerId", label: "Customer", sortable: true },
    { key: "bureau", label: "Bureau" }, { key: "creditScore", label: "Credit Score", sortable: true },
    { key: "riskGrade", label: "Risk Grade", sortable: true }, { key: "activeLoans", label: "Active Loans" },
    { key: "defaultHistory", label: "Default History" },
  ],
  idField: "id", statusField: "riskGrade", searchFields: ["customerId", "bureau"],
  apiBase: "/api/db/bureau-checks",
};
export default function MultiBureauCheckWorkspace() { return <CrudWorkspace config={config} />; }
