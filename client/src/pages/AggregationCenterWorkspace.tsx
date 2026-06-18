import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Building } from "lucide-react";

const config: CrudConfig = {
  domainKey: "aggregation-center",
  title: "Aggregation Center Management",
  subtitle: "Buying center ops, farmer delivery scheduling and weighing",
  icon: Building,
  accentColor: "teal",
  apiBase: "/api/db/aggregation-center",
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
    { key: "category", label: "Center Type" },
    { key: "amount", label: "Capacity" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AggregationCenterWorkspace() {
  return <CrudWorkspace config={config} />;
}
