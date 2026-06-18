import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "event-dedup",
  title: "Event Dedup Engine",
  subtitle: "Idempotency-key event deduplication",
  icon: Shield,
  accentColor: "green",
  apiBase: "/api/db/event-dedup-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["topic"],
  fields: [
    { key: "topic", label: "Topic", type: "text" },
    { key: "windowMs", label: "Window (ms)", type: "number" },
    { key: "strategy", label: "Strategy", type: "text" },
    { key: "dedupRate", label: "Dedup Rate", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "topic", label: "Topic" },
    { key: "windowMs", label: "Window (ms)" },
    { key: "strategy", label: "Strategy" },
    { key: "dedupRate", label: "Dedup Rate" },
    { key: "status", label: "Status" }
  ],
};

export default function EventDedupEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
