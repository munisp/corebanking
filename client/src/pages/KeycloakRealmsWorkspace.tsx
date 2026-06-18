import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function KeycloakRealmsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "keycloakrealms",
        title: "Keycloak Realms",
        subtitle: "Realm management — users, clients, roles, MFA policy, password policy, brute force protection",
        icon: Shield,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "displayName"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "displayName", label: "Display Name" },
          { key: "totalUsers", label: "Users", sortable: true },
          { key: "activeUsers24h", label: "Active 24h", sortable: true },
          { key: "totalClients", label: "Clients", sortable: true },
          { key: "mfaEnforced", label: "MFA", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
