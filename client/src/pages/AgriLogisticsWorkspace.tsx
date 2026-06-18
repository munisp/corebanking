import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Truck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "agri-logistics",
  title: "Agricultural Logistics",
  subtitle: "Truck dispatch, route optimization and cold chain monitoring",
  icon: Truck,
  accentColor: "teal",
  apiBase: "/api/db/agri-logistics",
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
    { key: "amount", label: "Cost (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AgriLogisticsWorkspace() {
  return <CrudWorkspace config={config} />;
}
