import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ArrowUpRight } from "lucide-react";

const config: CrudConfig = {
  domainKey: "response-compressor",
  title: "Response Compressor",
  subtitle: "Brotli/gzip/zstd per-service compression",
  icon: ArrowUpRight,
  accentColor: "teal",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["algorithm"],
  fields: [
    { key: "algorithm", label: "Algorithm", type: "text" },
    { key: "level", label: "Level", type: "number" },
    { key: "compressionRatio", label: "Ratio", type: "text" },
    { key: "bandwidthSaved24h", label: "Saved 24h", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "algorithm", label: "Algorithm" },
    { key: "level", label: "Level" },
    { key: "compressionRatio", label: "Ratio" },
    { key: "bandwidthSaved24h", label: "Saved 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function ResponseCompressorWorkspace() {
  return <CrudWorkspace config={config} />;
}
