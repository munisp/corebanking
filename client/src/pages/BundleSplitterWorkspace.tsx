import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Package } from "lucide-react";

const config: CrudConfig = {
  domainKey: "bundle-splitter",
  title: "Bundle Splitter",
  subtitle: "Domain-based code splitting analyzer",
  icon: Package,
  accentColor: "orange",
  apiBase: "/api/db/bundle-split-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["chunk"],
  fields: [
    { key: "chunk", label: "Chunk", type: "text" },
    { key: "routes", label: "Routes", type: "number" },
    { key: "sizeKB", label: "Size KB", type: "number" },
    { key: "loadTimeMs", label: "Load (ms)", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "chunk", label: "Chunk" },
    { key: "routes", label: "Routes" },
    { key: "sizeKB", label: "Size KB" },
    { key: "loadTimeMs", label: "Load (ms)" },
    { key: "status", label: "Status" }
  ],
};

export default function BundleSplitterWorkspace() {
  return <CrudWorkspace config={config} />;
}
