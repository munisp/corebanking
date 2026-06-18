import { Search } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "infra-opensearch",
  title: "OpenSearch Analytics",
  subtitle: "Search infrastructure — index management, full-text search, aggregations, alerting rules",
  icon: Search,
  accentColor: "teal",
  fields: [
    { key: "name", label: "Index Name", type: "readonly" },
    { key: "docs_count", label: "Documents", type: "readonly" },
    { key: "size_bytes", label: "Size (B)", type: "readonly" },
    { key: "shards", label: "Shards", type: "readonly" },
    { key: "replicas", label: "Replicas", type: "readonly" },
    { key: "status", label: "Status", type: "readonly" },
  ],
  columns: [
    { key: "name", label: "Index" },
    { key: "docs_count", label: "Documents" },
    { key: "shards", label: "Shards" },
    { key: "replicas", label: "Replicas" },
    { key: "status", label: "Status" },
  ],
  idField: "name",
  statusField: "status",
  searchFields: ["name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function InfraOpenSearchWorkspace() {
  return <CrudWorkspace config={config} />;
}
