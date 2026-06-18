import CrudWorkspace from "@/components/CrudWorkspace";
import { Users } from "lucide-react";

export default function KeycloakRolesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "keycloakroles",
        title: "Keycloak Roles",
        subtitle: "RBAC role management — composite roles, permissions, user assignment for banking operations",
        icon: Users,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "name",
        searchFields: ["id", "name", "realm", "description"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "realm", label: "Realm", sortable: true },
          { key: "usersAssigned", label: "Users", sortable: true },
          { key: "composite", label: "Composite" },
          { key: "clientRole", label: "Client Role" },
        ],
        fields: [],
      }}
    />
  );
}
