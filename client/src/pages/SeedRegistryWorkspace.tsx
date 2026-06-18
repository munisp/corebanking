import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

const config: CrudConfig = {
  domainKey: "seed-registry",
  title: "Seed Data Registry",
  subtitle: "Service seed data management and reset controls",
  icon: Database,
  accentColor: "orange",
  idField: "name",
  searchFields: ["name", "language"],
  apiBase: "/api/db/accounts",
  columns: [
    { key: "name", label: "Service", sortable: true },
    { key: "port", label: "Port", sortable: true },
    { key: "language", label: "Language", sortable: true },
    { key: "resetEndpoint", label: "Reset Endpoint", sortable: false },
    { key: "seededRecords", label: "Seeded Records", sortable: true },
  ],
  fields: [
    { key: "name", label: "Service Name", type: "text", required: true },
    { key: "port", label: "Port", type: "number", required: true },
    { key: "language", label: "Language", type: "select", options: ["go", "rust", "python"] },
    { key: "seededRecords", label: "Seeded Records", type: "number" },
  ],
};

export default function SeedRegistryWorkspace() {
  return <CrudWorkspace config={config} />;
}
