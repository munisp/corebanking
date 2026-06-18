import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Upload } from "lucide-react";

const config: CrudConfig = {
  domainKey: "siem-exporter",
  title: "SIEM Exporter",
  subtitle: "Splunk/QRadar/Elastic export pipelines",
  icon: Upload,
  accentColor: "purple",
  apiBase: "/api/db/siem-pipelines",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "format", label: "Format", type: "text" },
    { key: "eventsExported24h", label: "Events 24h", type: "number" },
    { key: "avgLatencyMs", label: "Latency", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "format", label: "Format" },
    { key: "eventsExported24h", label: "Events 24h" },
    { key: "avgLatencyMs", label: "Latency" },
    { key: "status", label: "Status" }
  ],
};

export default function SIEMExporterWorkspace() {
  return <CrudWorkspace config={config} />;
}
