import CrudWorkspace from "@/components/CrudWorkspace";
import { Settings } from "lucide-react";

export default function ApisixPluginsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "apisixplugins",
        title: "APISIX Plugins",
        subtitle: "Plugin configuration — auth, security, traffic, observability, transformation plugins",
        icon: Settings,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "category"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "scope", label: "Scope", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "routesUsing", label: "Routes", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
