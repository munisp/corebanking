import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";
const config: CrudConfig = {
  domainKey: "nfiu-ctr-str-filing", title: "NFIU CTR/STR Filing",
  subtitle: "Automated Currency Transaction Reports (>₦5M individual / >₦10M corporate) and Suspicious Transaction Reports. 72-hour SLA. goAML XML submission.",
  icon: FileText, accentColor: "red",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "type", label: "Report Type", type: "select", options: ["CTR", "STR"] },
    { key: "status", label: "Status", type: "select", options: ["filed", "pending_review", "under_review", "escalated_to_cco"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "customerName", label: "Customer", sortable: true },
    { key: "amountNGN", label: "Amount (₦)" }, { key: "transactionType", label: "Tx Type" },
    { key: "status", label: "Status", sortable: true }, { key: "cbnReference", label: "CBN Ref" },
    { key: "slaStatus", label: "SLA Status" },
  ],
  idField: "id", statusField: "status", searchFields: ["customerName", "customerId", "status"],
  apiBase: "/api/db/accounts",
};
export default function NFIUCTRSTRFilingWorkspace() { return <CrudWorkspace config={config} />; }
