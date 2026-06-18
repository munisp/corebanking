import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Banknote } from "lucide-react";

const config: CrudConfig = {
  domainKey: "livestock-finance",
  title: "Livestock Financing",
  subtitle: "Asset-based lending against herds, fattening cycle and feed loans",
  icon: Banknote,
  accentColor: "orange",
  apiBase: "/api/db/livestock-finance",
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
    { key: "category", label: "Type" },
    { key: "amount", label: "Amount (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function LivestockFinanceWorkspace() {
  return <CrudWorkspace config={config} />;
}
