import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ToggleRight } from "lucide-react";

const config: CrudConfig = {
  domainKey: "feature-flag-engine",
  title: "Feature Flag Engine",
  subtitle: "Advanced feature flags with graduated rollout, targeting rules, scheduling, A/B testing, and kill switches",
  icon: ToggleRight,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Flag ID", sortable: true },
    { key: "key", label: "Key", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "enabled", label: "Enabled", sortable: true },
    { key: "rolloutPct", label: "Rollout %", sortable: true },
    { key: "environment", label: "Environment", sortable: true },
    { key: "killSwitch", label: "Kill Switch", sortable: false },
    { key: "createdBy", label: "Created By", sortable: false },
  ],
  idField: "id",
  searchFields: ["id", "key", "name", "enabled"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function FeatureFlagEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
