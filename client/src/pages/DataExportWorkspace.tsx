import CrudWorkspace from "@/components/CrudWorkspace";
import { Download } from "lucide-react";

export default function DataExportWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "data-export",
        title: "Data Export Engine",
        subtitle: "CSV/Excel/JSON/XML/Parquet generation, scheduled exports, ETL feeds (Rust :8148)",
        icon: Download,
        accentColor: "text-indigo-600",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "export_type", "format", "source", "requested_by"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Export Name", sortable: true },
          { key: "export_type", label: "Type", sortable: true },
          { key: "format", label: "Format", sortable: true },
          { key: "source", label: "Source" },
          { key: "status", label: "Status", sortable: true },
          { key: "row_count", label: "Rows", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "file_size_bytes", label: "Size", render: (v) => { const n = Number(v); return n >= 1e6 ? `${(n/1e6).toFixed(1)}MB` : `${(n/1e3).toFixed(0)}KB`; } },
          { key: "requested_by", label: "Requested By" },
          { key: "requested_at", label: "Requested", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
