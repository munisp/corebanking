import CrudWorkspace from "@/components/CrudWorkspace";
import { GitBranch } from "lucide-react";

export default function MultiEntityWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "multi-entity",
        title: "Multi-Entity Management",
        subtitle: "Group structure, subsidiaries, intercompany, consolidated reporting (Go :8184)",
        icon: GitBranch,
        accentColor: "text-slate-700",
        idField: "id",
        statusField: "status",
        searchFields: ["entity_name", "entity_type"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Entity ID" },
          { key: "entity_name", label: "Entity", sortable: true },
          { key: "entity_type", label: "Type", sortable: true },
          { key: "country", label: "Country", sortable: true },
          { key: "currency", label: "Currency" },
          { key: "total_assets", label: "Assets", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
