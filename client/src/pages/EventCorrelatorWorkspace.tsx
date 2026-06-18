import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

const config: CrudConfig = {
  domainKey: "event-correlator",
  title: "Security Event Correlator",
  subtitle: "MITRE ATT&CK event correlation engine",
  icon: Activity,
  accentColor: "red",
  apiBase: "/api/db/correlation-rules",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "killChainPhase", label: "Kill Chain", type: "text" },
    { key: "triggered24h", label: "Triggered 24h", type: "number" },
    { key: "truePositives", label: "True Positives", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "killChainPhase", label: "Kill Chain" },
    { key: "triggered24h", label: "Triggered 24h" },
    { key: "truePositives", label: "True Positives" },
    { key: "status", label: "Status" }
  ],
};

export default function EventCorrelatorWorkspace() {
  return <CrudWorkspace config={config} />;
}
