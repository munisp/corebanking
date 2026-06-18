import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sar-filing",
  title: "SAR Filing Engine",
  subtitle: "Automated SAR/STR generation and NFIU filing",
  icon: FileText,
  accentColor: "orange",
  apiBase: "/api/db/sar-reports-aml",
  idField: "id",
  statusField: "status",
  searchFields: ["customerId"],
  fields: [
    { key: "customerId", label: "Customer ID", type: "text" },
    { key: "customerName", label: "Customer", type: "text" },
    { key: "reportType", label: "Type", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "status", label: "Status", type: "text" },
    { key: "priority", label: "Priority", type: "text" }
  ],
  columns: [
    { key: "customerId", label: "Customer ID" },
    { key: "customerName", label: "Customer" },
    { key: "reportType", label: "Type" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" }
  ],
};

export default function SARFilingEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
