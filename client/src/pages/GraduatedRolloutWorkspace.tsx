import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Gauge } from "lucide-react";

const config: CrudConfig = {
  domainKey: "graduated-rollout",
  title: "Graduated Rollout",
  subtitle: "Percentage-based rollout with canary deployments, ring-based expansion, and automatic rollback",
  icon: Gauge,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Rollout ID", sortable: true },
    { key: "featureKey", label: "Feature", sortable: true },
    { key: "name", label: "Plan Name", sortable: true },
    { key: "strategy", label: "Strategy", sortable: true },
    { key: "currentStage", label: "Current Stage", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "autoRollback", label: "Auto Rollback", sortable: false },
  ],
  idField: "id",
  searchFields: ["id", "featureKey", "name", "strategy"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function GraduatedRolloutWorkspace() {
  return <CrudWorkspace config={config} />;
}
