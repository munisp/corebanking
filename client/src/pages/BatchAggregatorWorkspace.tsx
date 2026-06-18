import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Package } from "lucide-react";

const config: CrudConfig = {
  domainKey: "batch-aggregator",
  title: "Batch Request Aggregator",
  subtitle: "Multi-request batching for N+1 elimination",
  icon: Package,
  accentColor: "blue",
  apiBase: "/api/db/batch-aggregator-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["endpoint"],
  fields: [
    { key: "endpoint", label: "Endpoint", type: "text" },
    { key: "maxRequests", label: "Max Requests", type: "number" },
    { key: "avgBatchSize", label: "Avg Batch", type: "number" },
    { key: "latencyReductionPct", label: "Reduction", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "endpoint", label: "Endpoint" },
    { key: "maxRequests", label: "Max Requests" },
    { key: "avgBatchSize", label: "Avg Batch" },
    { key: "latencyReductionPct", label: "Reduction" },
    { key: "status", label: "Status" }
  ],
};

export default function BatchAggregatorWorkspace() {
  return <CrudWorkspace config={config} />;
}
