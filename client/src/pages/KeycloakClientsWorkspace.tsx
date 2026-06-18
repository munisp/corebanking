import CrudWorkspace from "@/components/CrudWorkspace";
import { Key } from "lucide-react";

export default function KeycloakClientsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "keycloakclients",
        title: "Keycloak Clients",
        subtitle: "OAuth2/OIDC client registration — public, confidential, bearer-only with scopes and redirect URIs",
        icon: Key,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "clientId", "name"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "clientId", label: "Client ID", sortable: true },
          { key: "name", label: "Name", sortable: true },
          { key: "accessType", label: "Type", sortable: true },
          { key: "activeTokens", label: "Tokens", sortable: true },
          { key: "requestsPerDay", label: "Reqs/Day", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
