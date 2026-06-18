import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { PiggyBank } from "lucide-react";

const config: CrudConfig = {
  domainKey: "agri-savings-cycles",
  title: "Agriculture Savings Cycles",
  subtitle: "VSLA and ROSCA cycle management with contributions and share-out",
  icon: PiggyBank,
  accentColor: "teal",
  apiBase: "/api/db/agri-savings-cycles",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "region", label: "Region", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Type" },
    { key: "amount", label: "Total (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AgriSavingsCyclesWorkspace() {
  return <CrudWorkspace config={config} />;
}
