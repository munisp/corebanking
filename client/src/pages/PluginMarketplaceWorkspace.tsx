import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Store } from "lucide-react";

const config: CrudConfig = {
  domainKey: "plugin-marketplace",
  title: "Plugin Marketplace",
  subtitle: "Third-party integration ecosystem: install, configure, and manage plugins per tenant",
  icon: Store,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Plugin ID", sortable: true },
    { key: "name", label: "Plugin Name", sortable: true },
    { key: "vendor", label: "Vendor", sortable: true },
    { key: "category", label: "Category", sortable: true },
    { key: "version", label: "Version", sortable: true },
    { key: "installs", label: "Installs", sortable: true },
    { key: "rating", label: "Rating", sortable: true },
    { key: "pricing", label: "Pricing", sortable: false },
  ],
  idField: "id",
  searchFields: ["id", "name", "vendor", "category"],
  apiBase: "/api/db/tenants",
  pageSize: 25,
};

export default function PluginMarketplaceWorkspace() {
  return <CrudWorkspace config={config} />;
}
