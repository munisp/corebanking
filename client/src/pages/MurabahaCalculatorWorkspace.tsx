import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Calculator } from "lucide-react";

const config: CrudConfig = {
  domainKey: "murabaha-calculator",
  title: "Murabaha Calculator",
  subtitle: "Islamic cost-plus financing quotation engine",
  icon: Calculator,
  accentColor: "emerald",
  idField: "id",
  searchFields: ["assetDescription", "customerId", "status"],
  apiBase: "/api/db/accounts",
  columns: [
    { key: "id", label: "Quote ID", sortable: true },
    { key: "assetDescription", label: "Asset", sortable: true },
    { key: "costPrice", label: "Cost Price (₦)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "profitMargin", label: "Margin %", sortable: true, render: (v) => `${v}%` },
    { key: "sellingPrice", label: "Selling Price (₦)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "tenorMonths", label: "Tenor", sortable: true, render: (v) => `${v} months` },
    { key: "monthlyInstallment", label: "Monthly (₦)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "status", label: "Status", sortable: true },
  ],
  fields: [
    { key: "assetDescription", label: "Asset Description", type: "text", required: true },
    { key: "costPrice", label: "Cost Price", type: "number", required: true, min: 1000 },
    { key: "profitMargin", label: "Profit Margin (%)", type: "number", required: true, min: 1, max: 50 },
    { key: "tenorMonths", label: "Tenor (Months)", type: "number", required: true, min: 1, max: 360 },
    { key: "currency", label: "Currency", type: "select", options: ["NGN", "USD", "GBP", "EUR"] },
    { key: "status", label: "Status", type: "select", options: ["draft", "pending_approval", "approved", "disbursed", "completed"] },
  ],
};

export default function MurabahaCalculatorWorkspace() {
  return <CrudWorkspace config={config} />;
}
