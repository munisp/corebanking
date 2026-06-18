import { Clock } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "eod-processor",
  title: "EOD/BOD Processing Engine",
  subtitle: "Orchestrated 18-step daily batch pipeline — interest accrual, maturity, GL balancing, regulatory extracts",
  icon: Clock,
  accentColor: "emerald",
  fields: [
    { key: "id", label: "Run ID", type: "readonly" },
    { key: "businessDate", label: "Business Date", type: "readonly" },
    { key: "status", label: "Status", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "Run ID" },
    { key: "businessDate", label: "Business Date" },
    { key: "status", label: "Status" },
    { key: "totalDuration", label: "Duration (s)" },
    { key: "initiatedBy", label: "Initiated By" },
  ],
  idField: "id",
  searchFields: ["id", "businessDate", "status"],
  apiBase: "/api/db/accounts",
};

export default function EODProcessorWorkspace() {
  return <CrudWorkspace config={config} />;
}
