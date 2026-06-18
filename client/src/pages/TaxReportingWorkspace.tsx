import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileSpreadsheet } from "lucide-react";
const config: CrudConfig = {
  domainKey: "tax-reporting", title: "Tax Reporting",
  subtitle: "WHT, VAT, PAYE, and CIT reporting for FIRS compliance.",
  icon: FileSpreadsheet, accentColor: "purple",
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
export default function TaxReportingWorkspace() { return <CrudWorkspace config={config} />; }
