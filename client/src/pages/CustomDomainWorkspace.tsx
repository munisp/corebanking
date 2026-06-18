import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

const config: CrudConfig = {
  domainKey: "custom-domains",
  title: "Custom Domains",
  subtitle: "Automated SSL provisioning, DNS verification, APISIX routing, and certificate lifecycle management",
  icon: Globe,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Domain ID", sortable: true },
    { key: "tenantId", label: "Tenant", sortable: true },
    { key: "domain", label: "Domain", sortable: true },
    { key: "sslStatus", label: "SSL Status", sortable: true },
    { key: "dnsStatus", label: "DNS Status", sortable: true },
    { key: "certProvider", label: "Cert Provider", sortable: false },
    { key: "enabled", label: "Enabled", sortable: true },
  ],
  idField: "id",
  searchFields: ["id", "tenantId", "domain", "sslStatus"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function CustomDomainWorkspace() {
  return <CrudWorkspace config={config} />;
}
