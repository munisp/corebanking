import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Paintbrush } from "lucide-react";

const config: CrudConfig = {
  domainKey: "white-label-engine",
  title: "White Label Engine",
  subtitle: "Runtime theme injection, custom domains, branded email and PDF templates per tenant",
  icon: Paintbrush,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "tenantId", label: "Tenant ID", sortable: true },
    { key: "displayName", label: "Display Name", sortable: true },
    { key: "legalEntity", label: "Legal Entity", sortable: true },
    { key: "primaryColor", label: "Primary Color", sortable: false },
    { key: "accentColor", label: "Accent Color", sortable: false },
    { key: "fontFamily", label: "Font", sortable: false },
    { key: "darkModeEnabled", label: "Dark Mode", sortable: true },
  ],
  idField: "tenantId",
  searchFields: ["tenantId", "displayName", "legalEntity", "primaryColor"],
  apiBase: "/api/db/tenants",
  pageSize: 25,
};

export default function WhiteLabelEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
