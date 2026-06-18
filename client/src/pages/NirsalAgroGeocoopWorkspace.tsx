import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

const config: CrudConfig = {
  domainKey: "nirsal-agro-geocoop",
  title: "NIRSAL Agro Geo-Cooperative",
  subtitle: "Geo-mapping farming clusters and satellite-verified production data",
  icon: Globe,
  accentColor: "emerald",
  apiBase: "/api/db/nirsal-agro-geocoop",
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

export default function NirsalAgroGeocoopWorkspace() {
  return <CrudWorkspace config={config} />;
}
