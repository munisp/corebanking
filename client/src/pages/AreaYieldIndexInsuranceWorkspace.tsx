import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { CloudRain } from "lucide-react";

const config: CrudConfig = {
  domainKey: "area-yield-index-insurance",
  title: "Area Yield Index Insurance",
  subtitle: "Regional yield shortfall triggers and parametric payouts",
  icon: CloudRain,
  accentColor: "slate",
  apiBase: "/api/db/area-yield-index-insurance",
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

export default function AreaYieldIndexInsuranceWorkspace() {
  return <CrudWorkspace config={config} />;
}
