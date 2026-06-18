import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ArrowUpRight } from "lucide-react";

const config: CrudConfig = {
  domainKey: "wire-transfer-monitor",
  title: "Wire Transfer Monitor (Travel Rule)",
  subtitle: "FATF Travel Rule compliance — originator/beneficiary info",
  icon: ArrowUpRight,
  accentColor: "orange",
  apiBase: "/api/db/wire-transfer-monitor",
  idField: "id",
  statusField: "status",
  searchFields: ["originatorName"],
  fields: [
    { key: "originatorName", label: "Originator", type: "text" },
    { key: "beneficiaryName", label: "Beneficiary", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "currency", label: "CCY", type: "text" },
    { key: "travelRuleCompliant", label: "Compliant", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "originatorName", label: "Originator" },
    { key: "beneficiaryName", label: "Beneficiary" },
    { key: "amount", label: "Amount" },
    { key: "currency", label: "CCY" },
    { key: "travelRuleCompliant", label: "Compliant" },
    { key: "status", label: "Status" }
  ],
};

export default function WireTransferMonitorWorkspace() {
  return <CrudWorkspace config={config} />;
}
