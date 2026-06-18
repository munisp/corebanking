import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Map } from "lucide-react";

const config: CrudConfig = {
  domainKey: "farm-boundary-mapping",
  title: "Farm Boundary Mapping",
  subtitle: "Polygon farm boundaries, area verification and overlap detection",
  icon: Map,
  accentColor: "green",
  apiBase: "/api/db/farm-boundary-mapping",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Type" },
    { key: "amount", label: "Area (ha)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function FarmBoundaryMappingWorkspace() {
  return <CrudWorkspace config={config} />;
}
