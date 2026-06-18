import CrudWorkspace from "@/components/CrudWorkspace";
import { Link2 } from "lucide-react";

export default function KeycloakIdPsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "keycloakidps",
        title: "Identity Providers",
        subtitle: "Federated identity — NIBSS BVN, Google SSO, Microsoft AD, Apple Sign-In integration",
        icon: Link2,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "alias", "displayName", "providerId"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "alias", label: "Alias", sortable: true },
          { key: "displayName", label: "Name", sortable: true },
          { key: "providerId", label: "Type", sortable: true },
          { key: "usersLinked", label: "Users", sortable: true },
          { key: "loginCount30d", label: "Logins 30d", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
