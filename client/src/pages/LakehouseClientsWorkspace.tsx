import CrudWorkspace from "@/components/CrudWorkspace";
import { Code } from "lucide-react";

export default function LakehouseClientsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "lakehouseclients",
        title: "Lakehouse Shared Clients",
        subtitle: "Go, Rust, Python shared lakehouse client libraries — unified API for CDC publish, query, ingest, lineage",
        icon: Code,
        accentColor: "text-emerald-700",
        idField: "language",
        statusField: "language",
        searchFields: ["language", "module"],
        apiBase: "/api/db/avro-schemas",
        pageSize: 25,
        columns: [
          { key: "language", label: "Language", sortable: true },
          { key: "module", label: "Module" },
          { key: "description", label: "Description" },
        ],
        fields: [],
      }}
    />
  );
}
