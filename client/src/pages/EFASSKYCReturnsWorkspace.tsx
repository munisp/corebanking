import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";
const config: CrudConfig = {
  domainKey: "efass-kyc-returns", title: "CBN eFASS KYC Returns",
  subtitle: "Monthly/quarterly/annual KYC statistics for CBN electronic Financial Analysis and Surveillance System (eFASS). XML template generation.",
  icon: FileText, accentColor: "emerald",
  fields: [
    { key: "period", label: "Period", type: "text", required: true },
    { key: "type", label: "Type", type: "select", options: ["monthly", "quarterly", "annual"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "period", label: "Period", sortable: true },
    { key: "type", label: "Type" }, { key: "tier1Count", label: "Tier 1" },
    { key: "tier2Count", label: "Tier 2" }, { key: "tier3Count", label: "Tier 3" },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["period", "type"],
  apiBase: "/api/db/efass-returns",
};
export default function EFASSKYCReturnsWorkspace() { return <CrudWorkspace config={config} />; }
