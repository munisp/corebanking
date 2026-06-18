import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Receipt } from "lucide-react";

const config: CrudConfig = {
  domainKey: "cooperative-financials",
  title: "Cooperative Financial Statements",
  subtitle: "P&L, balance sheet, member equity and dividend calculation",
  icon: Receipt,
  accentColor: "slate",
  apiBase: "/api/db/cooperative-financials",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Statement Type" },
    { key: "amount", label: "Amount (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function CooperativeFinancialsWorkspace() {
  return <CrudWorkspace config={config} />;
}
