import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldPlus } from "lucide-react";

const config: CrudConfig = {
  domainKey: "billing-rbac",
  title: "Billing RBAC Gateway",
  subtitle: "Permify/Keycloak permission enforcement, policy rules, access decisions, change notifications",
  icon: ShieldPlus,
  accentColor: "purple",
  fields: [],
  columns: [
    { key: "id", label: "Policy ID", sortable: true },
    { key: "resource", label: "Resource", sortable: true },
    { key: "action", label: "Action", sortable: true },
    { key: "allowedRoles", label: "Allowed Roles", sortable: false },
    { key: "enforcementMode", label: "Mode", sortable: true },
    { key: "permifyRelation", label: "Permify Relation", sortable: false },
    { key: "keycloakScope", label: "Keycloak Scope", sortable: false },
  ],
  idField: "id",
  searchFields: ["id", "resource", "action", "enforcementMode"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function BillingRbacWorkspace() {
  return <CrudWorkspace config={config} />;
}
