import { FileText } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "statement-generator",
  title: "Statement Generator",
  subtitle: "PDF / MT940 / MT942 account statement generation and delivery",
  icon: FileText,
  accentColor: "cyan",
  fields: [
    { key: "id", label: "Statement ID", type: "readonly" },
    { key: "accountNumber", label: "Account No.", type: "readonly" },
    { key: "format", label: "Format", type: "select", options: ["pdf", "mt940", "mt942", "csv", "excel"] },
  ],
  columns: [
    { key: "id", label: "Statement ID" },
    { key: "accountNumber", label: "Account No." },
    { key: "accountName", label: "Account Name" },
    { key: "format", label: "Format" },
    { key: "period", label: "Period" },
    { key: "status", label: "Status" },
    { key: "deliveryChannel", label: "Channel" },
  ],
  idField: "id",
  searchFields: ["id", "accountNumber", "accountName", "format"],
  apiBase: "/api/db/customer-statements",
};

export default function StatementGeneratorWorkspace() {
  return <CrudWorkspace config={config} />;
}
