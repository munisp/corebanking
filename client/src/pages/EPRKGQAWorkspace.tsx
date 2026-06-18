import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Search } from "lucide-react";
const config: CrudConfig = {
  domainKey: "epr-kgqa", title: "EPR-KGQA — Knowledge Graph QA",
  subtitle: "Evidence Pattern Retrieval for natural language question answering over the banking knowledge graph. Ask compliance and AML questions in plain English.",
  icon: Search, accentColor: "indigo",
  fields: [
    { key: "question", label: "Question", type: "text", required: true },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "question", label: "Question" },
    { key: "latencyMs", label: "Latency (ms)", sortable: true },
  ],
  idField: "id", searchFields: ["question"],
  apiBase: "/api/db/anomaly-models",
};
export default function EPRKGQAWorkspace() { return <CrudWorkspace config={config} />; }
