import { FileText } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "mandate-management",
  title: "Mandate Management",
  subtitle: "Direct debit mandate lifecycle — creation, activation, execution, suspension, cancellation",
  icon: FileText,
  accentColor: "sky",
  fields: [
    { key: "id", label: "Mandate ID", type: "readonly" },
    { key: "accountNumber", label: "Account No.", type: "readonly" },
    { key: "beneficiary", label: "Beneficiary", type: "text" },
  ],
  columns: [
    { key: "id", label: "Mandate ID" },
    { key: "accountName", label: "Account Name" },
    { key: "beneficiary", label: "Beneficiary" },
    { key: "type", label: "Type" },
    { key: "amount", label: "Amount ₦" },
    { key: "frequency", label: "Frequency" },
    { key: "status", label: "Status" },
    { key: "totalExecutions", label: "Executions" },
  ],
  idField: "id",
  searchFields: ["id", "accountName", "beneficiary"],
  apiBase: "/api/db/transfers",
};

export default function MandateManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
