import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

const config: CrudConfig = {
  domainKey: "virtual-scroll",
  title: "Virtual Scroll Engine",
  subtitle: "Viewport-only rendering for massive tables",
  icon: Layers,
  accentColor: "green",
  apiBase: "/api/db/virtual-scroll-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["tableName"],
  fields: [
    { key: "tableName", label: "Table", type: "text" },
    { key: "totalRows", label: "Total Rows", type: "number" },
    { key: "viewportRows", label: "Viewport", type: "number" },
    { key: "renderTimeMs", label: "Render (ms)", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "tableName", label: "Table" },
    { key: "totalRows", label: "Total Rows" },
    { key: "viewportRows", label: "Viewport" },
    { key: "renderTimeMs", label: "Render (ms)" },
    { key: "status", label: "Status" }
  ],
};

export default function VirtualScrollEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
