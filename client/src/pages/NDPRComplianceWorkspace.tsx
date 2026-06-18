import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "ndpr-compliance",
  title: "NDPR Compliance",
  subtitle: "Nigeria Data Protection Regulation",
  icon: FileCheck,
  accentColor: "green",
  apiBase: "/api/db/ndpr-records",
  idField: "id",
  statusField: "status",
  searchFields: ["type"],
  fields: [
    { key: "type", label: "Type", type: "text" },
    { key: "subject", label: "Subject", type: "text" },
    { key: "requestType", label: "Request Type", type: "text" },
    { key: "responseTimeDays", label: "Response Days", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "type", label: "Type" },
    { key: "subject", label: "Subject" },
    { key: "requestType", label: "Request Type" },
    { key: "responseTimeDays", label: "Response Days" },
    { key: "status", label: "Status" }
  ],
};

export default function NDPRComplianceWorkspace() {
  return <CrudWorkspace config={config} />;
}
