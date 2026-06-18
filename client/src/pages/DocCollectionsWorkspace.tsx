import CrudWorkspace from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

export default function DocCollectionsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "doc-collections",
        title: "Documentary Collections",
        subtitle: "D/P, D/A, clean collections — SWIFT messaging, document tracking, settlement",
        icon: FileText,
        accentColor: "text-violet-600",
        idField: "id",
        statusField: "status",
        searchFields: ["collectionNumber", "type"],
        apiBase: "/api/db/bank-guarantees",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "collectionNumber", label: "Collection #", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "amount", label: "Amount", sortable: true, render: (v, row) => `${row.currency} ${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
          { key: "charges", label: "Charges", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "swiftMessages", label: "SWIFT", render: (v) => Array.isArray(v) ? v.join(", ") : "" },
          { key: "createdAt", label: "Created", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
