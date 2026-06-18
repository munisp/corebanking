import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Bug } from "lucide-react";

const config: CrudConfig = {
  domainKey: "livestock-management",
  title: "Livestock Management",
  subtitle: "Cattle, poultry, goat, sheep herd tracking and health records",
  icon: Bug,
  accentColor: "amber",
  apiBase: "/api/db/livestock-management",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "tag", label: "Tag", type: "text" },
    { key: "species", label: "Species", type: "text" },
    { key: "breed", label: "Breed", type: "text" },
    { key: "healthStatus", label: "Health", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "tag", label: "Tag" },
    { key: "species", label: "Species" },
    { key: "breed", label: "Breed" },
    { key: "weightKg", label: "Weight (kg)" },
    { key: "healthStatus", label: "Health" },
    { key: "status", label: "Status" }
  ],
};

export default function LivestockManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
