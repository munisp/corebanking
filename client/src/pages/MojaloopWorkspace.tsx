import { Globe } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "mojaloop",
  title: "Mojaloop Interoperability",
  subtitle: "Cross-institution transfers — participants, party lookup, quotes, settlements",
  icon: Globe,
  accentColor: "bg-blue-700",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "payerFsp", "payeeFsp", "currency"],
  apiBase: "/api/db/transfers",
  fields: [
    { key: "quoteId", label: "Quote ID", type: "text", required: true },
    { key: "amount", label: "Amount", type: "number", required: true },
  ],
  columns: [
    { key: "id", label: "Transfer ID" },
    { key: "quoteId", label: "Quote" },
    { key: "payerFsp", label: "Payer FSP" },
    { key: "payeeFsp", label: "Payee FSP" },
    { key: "amount", label: "Amount", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "fee", label: "Fee", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "status", label: "Status" },
  ],
  actions: [],
};

export default function MojaloopWorkspace() {
  return <CrudWorkspace config={config} />;
}
