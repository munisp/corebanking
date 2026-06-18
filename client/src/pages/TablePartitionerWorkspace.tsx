import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

const config: CrudConfig = {
  domainKey: "table-partitioner",
  title: "Table Partitioner",
  subtitle: "Time-series range partitioning with auto-prune",
  icon: Layers,
  accentColor: "blue",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["tableName"],
  fields: [
    { key: "tableName", label: "Table", type: "text" },
    { key: "partitionKey", label: "Key", type: "text" },
    { key: "partitionType", label: "Type", type: "text" },
    { key: "activePartitions", label: "Partitions", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "tableName", label: "Table" },
    { key: "partitionKey", label: "Key" },
    { key: "partitionType", label: "Type" },
    { key: "activePartitions", label: "Partitions" },
    { key: "status", label: "Status" }
  ],
};

export default function TablePartitionerWorkspace() {
  return <CrudWorkspace config={config} />;
}
