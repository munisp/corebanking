import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BarChart2 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sorted-set-ranking",
  title: "Sorted Set Rankings",
  subtitle: "Real-time O(log N) Redis rankings",
  icon: BarChart2,
  accentColor: "blue",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "members", label: "Members", type: "number" },
    { key: "topScore", label: "Top Score", type: "number" },
    { key: "queryLatencyMs", label: "Latency (ms)", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "members", label: "Members" },
    { key: "topScore", label: "Top Score" },
    { key: "queryLatencyMs", label: "Latency (ms)" },
    { key: "status", label: "Status" }
  ],
};

export default function SortedSetRankingWorkspace() {
  return <CrudWorkspace config={config} />;
}
