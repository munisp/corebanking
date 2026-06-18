import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Tractor } from "lucide-react";

const config: CrudConfig = {
  domainKey: "equipment-leasing",
  title: "Equipment Leasing",
  subtitle: "Tractor rental marketplace and mechanization-as-a-service",
  icon: Tractor,
  accentColor: "orange",
  apiBase: "/api/db/equipment-leasing",
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
    { key: "amount", label: "Lease Value" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function EquipmentLeasingWorkspace() {
  return <CrudWorkspace config={config} />;
}
