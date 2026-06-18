import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

const config: CrudConfig = {
  domainKey: "request-coalescer",
  title: "Request Coalescer",
  subtitle: "Duplicate in-flight request deduplication",
  icon: Layers,
  accentColor: "purple",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["route"],
  fields: [
    { key: "route", label: "Route", type: "text" },
    { key: "windowMs", label: "Window (ms)", type: "number" },
    { key: "savingsRatio", label: "Savings", type: "text" },
    { key: "avgWaiters", label: "Avg Waiters", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "route", label: "Route" },
    { key: "windowMs", label: "Window (ms)" },
    { key: "savingsRatio", label: "Savings" },
    { key: "avgWaiters", label: "Avg Waiters" },
    { key: "status", label: "Status" }
  ],
};

export default function RequestCoalescerWorkspace() {
  return <CrudWorkspace config={config} />;
}
