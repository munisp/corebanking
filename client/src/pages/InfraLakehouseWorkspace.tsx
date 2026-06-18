import { Database } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "infra-lakehouse",
  title: "Lakehouse ETL",
  subtitle: "Data warehouse — Apache Iceberg tables, ETL jobs, data quality rules, lineage tracking",
  icon: Database,
  accentColor: "indigo",
  fields: [
    { key: "name", label: "Table Name", type: "readonly" },
    { key: "schema", label: "Schema", type: "readonly" },
    { key: "format", label: "Format", type: "readonly" },
    { key: "rows", label: "Rows", type: "readonly" },
    { key: "sizeGB", label: "Size (GB)", type: "readonly" },
    { key: "partitionBy", label: "Partition", type: "readonly" },
  ],
  columns: [
    { key: "name", label: "Table" },
    { key: "schema", label: "Schema" },
    { key: "format", label: "Format" },
    { key: "rows", label: "Rows" },
    { key: "sizeGB", label: "Size (GB)" },
    { key: "partitionBy", label: "Partition" },
  ],
  idField: "name",
  searchFields: ["name", "schema"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function InfraLakehouseWorkspace() {
  return <CrudWorkspace config={config} />;
}
