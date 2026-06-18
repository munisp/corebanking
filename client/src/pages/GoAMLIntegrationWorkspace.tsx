import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

const config: CrudConfig = {
  domainKey: "goaml-integration",
  title: "goAML NFIU Integration",
  subtitle: "NFIU goAML XML report generation and submission",
  icon: FileText,
  accentColor: "green",
  apiBase: "/api/db/goaml-reports",
  idField: "id",
  statusField: "status",
  searchFields: ["reportType"],
  fields: [
    { key: "reportType", label: "Type", type: "text" },
    { key: "subject", label: "Subject", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "nfiuAcknowledgement", label: "NFIU Ack", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "reportType", label: "Type" },
    { key: "subject", label: "Subject" },
    { key: "amount", label: "Amount" },
    { key: "nfiuAcknowledgement", label: "NFIU Ack" },
    { key: "status", label: "Status" }
  ],
};

export default function GoAMLIntegrationWorkspace() {
  return <CrudWorkspace config={config} />;
}
