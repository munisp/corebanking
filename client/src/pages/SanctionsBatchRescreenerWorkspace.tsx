import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { RefreshCw } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sanctions-batch-rescreener",
  title: "Sanctions Batch Re-screener",
  subtitle: "Daily full-customer-base re-screening against all lists",
  icon: RefreshCw,
  accentColor: "red",
  apiBase: "/api/db/sanctions-batch-runs",
  idField: "id",
  statusField: "status",
  searchFields: ["triggerType"],
  fields: [
    { key: "triggerType", label: "Trigger", type: "text" },
    { key: "customersScreened", label: "Screened", type: "number" },
    { key: "newMatches", label: "New Matches", type: "number" },
    { key: "processingTimeMin", label: "Time (min)", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "triggerType", label: "Trigger" },
    { key: "customersScreened", label: "Screened" },
    { key: "newMatches", label: "New Matches" },
    { key: "processingTimeMin", label: "Time (min)" },
    { key: "status", label: "Status" }
  ],
};

export default function SanctionsBatchRescreenerWorkspace() {
  return <CrudWorkspace config={config} />;
}
