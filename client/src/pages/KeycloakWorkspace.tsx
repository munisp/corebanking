import { Users } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "keycloak-identity",
  title: "Identity & Access",
  subtitle: "Keycloak OIDC — realms, clients, users, identity providers, sessions",
  icon: Users,
  accentColor: "bg-teal-700",
  idField: "id",
  statusField: "enabled",
  searchFields: ["id", "username", "email", "firstName", "lastName"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "username", label: "Username", type: "text", required: true },
    { key: "email", label: "Email", type: "text", required: true },
    { key: "firstName", label: "First Name", type: "text" },
    { key: "lastName", label: "Last Name", type: "text" },
  ],
  columns: [
    { key: "id", label: "User ID" },
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "roles", label: "Roles", render: (v) => Array.isArray(v) ? v.join(", ") : "" },
    { key: "mfaEnabled", label: "MFA", render: (v) => v ? "Yes" : "No" },
  ],
  actions: [],
};

export default function KeycloakWorkspace() {
  return <CrudWorkspace config={config} />;
}
