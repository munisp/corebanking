import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Cpu } from "lucide-react";

const config: CrudConfig = {
  domainKey: "agri-iot-sensor",
  title: "Agricultural IoT Sensor",
  subtitle: "Soil moisture, irrigation control and weather station data",
  icon: Cpu,
  accentColor: "sky",
  apiBase: "/api/db/agri-iot-sensor",
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
    { key: "category", label: "Sensor Type" },
    { key: "amount", label: "Reading" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AgriIotSensorWorkspace() {
  return <CrudWorkspace config={config} />;
}
