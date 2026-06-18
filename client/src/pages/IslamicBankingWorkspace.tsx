import { Banknote } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "islamic-banking",
  title: "Islamic Banking Contracts",
  subtitle: "Sharia-compliant products — Murabaha, Ijara, Mudarabah",
  icon: Banknote,
  accentColor: "bg-teal-700",
  idField: "id",
  statusField: "status",
  searchFields: ["contractId", "customerId", "assetDescription"],
  apiBase: "/api/db/murabaha-contracts",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "assetDescription", label: "Asset Description", type: "text", required: true, placeholder: "e.g. Toyota Hilux" },
    { key: "costPrice", label: "Cost Price (₦)", type: "number", required: true },
    { key: "profitMargin", label: "Profit Margin (%)", type: "number", required: true, defaultValue: 10 },
    { key: "installments", label: "Installments", type: "number", required: true, defaultValue: 24 },
  ],
  columns: [
    { key: "contractId", label: "Contract ID" },
    { key: "customerId", label: "Customer" },
    { key: "assetDescription", label: "Asset" },
    { key: "costPrice", label: "Cost", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "sellingPrice", label: "Selling Price", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Approve", key: "approve", condition: (r) => r.status === "pending" },
    { label: "Activate", key: "activate", condition: (r) => r.status === "approved" },
  ],
};

export default function IslamicBankingWorkspace() {
  return <CrudWorkspace config={config} />;
}
