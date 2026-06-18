import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Warehouse } from "lucide-react";

const config: CrudConfig = {
  domainKey: "warehouse-management",
  title: "Warehouse Management System",
  subtitle: "Capacity tracking, inventory, quality testing and fumigation",
  icon: Warehouse,
  accentColor: "amber",
  apiBase: "/api/db/warehouse-management",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "amount", label: "Capacity", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Type" },
    { key: "amount", label: "Capacity" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function WarehouseManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
