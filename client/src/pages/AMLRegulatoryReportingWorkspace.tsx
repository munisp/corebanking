import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

const config: CrudConfig = {
  domainKey: "regulatory-reporting",
  title: "Regulatory Reporting Engine",
  subtitle: "CBN/NFIU/NDIC automated quarterly/monthly reports",
  icon: FileText,
  accentColor: "purple",
  apiBase: "/api/db/regulatory-reports-aml",
  idField: "id",
  statusField: "status",
  searchFields: ["reportType"],
  fields: [
    { key: "reportType", label: "Type", type: "text" },
    { key: "period", label: "Period", type: "text" },
    { key: "submittedTo", label: "Submitted To", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "reportType", label: "Type" },
    { key: "period", label: "Period" },
    { key: "submittedTo", label: "Submitted To" },
    { key: "status", label: "Status" }
  ],
};

export default function AMLRegulatoryReportingWorkspace() {
  return <CrudWorkspace config={config} />;
}
