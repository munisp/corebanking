import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Cpu } from "lucide-react";

const config: CrudConfig = {
  domainKey: "component-memoizer",
  title: "Component Memoizer",
  subtitle: "React.memo + useMemo optimization analyzer",
  icon: Cpu,
  accentColor: "purple",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["component"],
  fields: [
    { key: "component", label: "Component", type: "text" },
    { key: "rerendersPer60s", label: "Rerenders/60s", type: "number" },
    { key: "estimatedSavingPct", label: "Saving", type: "text" },
    { key: "recommendation", label: "Recommendation", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "component", label: "Component" },
    { key: "rerendersPer60s", label: "Rerenders/60s" },
    { key: "estimatedSavingPct", label: "Saving" },
    { key: "recommendation", label: "Recommendation" },
    { key: "status", label: "Status" }
  ],
};

export default function ComponentMemoizerWorkspace() {
  return <CrudWorkspace config={config} />;
}
