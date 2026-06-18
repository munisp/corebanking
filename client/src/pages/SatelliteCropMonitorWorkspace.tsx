import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Satellite } from "lucide-react";

const config: CrudConfig = {
  domainKey: "satellite-crop-monitor",
  title: "Satellite Crop Monitoring",
  subtitle: "Sentinel-2 NDVI vegetation index and crop health scoring",
  icon: Satellite,
  accentColor: "emerald",
  apiBase: "/api/db/satellite-crop-monitor",
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
    { key: "amount", label: "Value" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function SatelliteCropMonitorWorkspace() {
  return <CrudWorkspace config={config} />;
}
