import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe2 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "crossborder-agri-trade",
  title: "Cross Border Agri Trade",
  subtitle: "Cocoa to EU, cashew to India, sesame to Japan with Mojaloop corridors",
  icon: Globe2,
  accentColor: "blue",
  apiBase: "/api/db/crossborder-agri-trade",
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
    { key: "category", label: "Corridor" },
    { key: "amount", label: "Value (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function CrossborderAgriTradeWorkspace() {
  return <CrudWorkspace config={config} />;
}
