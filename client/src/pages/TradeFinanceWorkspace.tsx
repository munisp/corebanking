import { Globe } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "trade-finance",
  title: "Letters of Credit",
  subtitle: "Trade finance — LC issuance, SWIFT MT700, warehouse receipts, bank guarantees",
  icon: Globe,
  accentColor: "bg-emerald-700",
  idField: "id",
  statusField: "status",
  searchFields: ["lcId", "applicantId", "beneficiaryName", "swiftRef"],
  apiBase: "/api/db/letters-of-credit",
  fields: [
    { key: "applicantId", label: "Applicant Customer ID", type: "text", required: true },
    { key: "beneficiaryName", label: "Beneficiary Name", type: "text", required: true },
    { key: "amount", label: "Amount", type: "number", required: true },
    { key: "currency", label: "Currency", type: "select", options: ["USD", "EUR", "GBP", "NGN", "CNY"], required: true },
    { key: "goodsDescription", label: "Goods Description", type: "textarea" },
    { key: "expiryDate", label: "Expiry Date", type: "date" },
  ],
  columns: [
    { key: "lcId", label: "LC ID" },
    { key: "beneficiaryName", label: "Beneficiary" },
    { key: "amount", label: "Amount", render: (v, r) => `${r.currency} ${Number(v).toLocaleString()}` },
    { key: "swiftRef", label: "SWIFT Ref" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Issue", key: "issue", condition: (r) => r.status === "draft" },
    { label: "Confirm", key: "confirm", condition: (r) => r.status === "issued" },
    { label: "Amend", key: "amend", condition: (r) => r.status === "issued" || r.status === "confirmed" },
  ],
};

export default function TradeFinanceWorkspace() {
  return <CrudWorkspace config={config} />;
}
