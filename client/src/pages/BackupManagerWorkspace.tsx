import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { HardDrive } from "lucide-react";
const config: CrudConfig = {
  domainKey: "backup-manager", title: "Backup Manager",
  subtitle: "pg_dump full + WAL archiving + PITR — RPO 5min, RTO 30min, DR to eu-west-1.",
  icon: HardDrive, accentColor: "amber",
  fields: [
    { key: "id", label: "ID", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["active", "inactive", "pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/anomaly-models",
};
export default function BackupManagerWorkspace() { return <CrudWorkspace config={config} />; }
