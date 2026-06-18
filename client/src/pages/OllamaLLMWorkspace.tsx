import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";
const config: CrudConfig = {
  domainKey: "ollama-llm", title: "Ollama Local LLM",
  subtitle: "Local LLM inference: Llama 3.1 70B for compliance QA, CodeLlama 34B for SQL, Mistral 7B for entity extraction, Nomic for embeddings.",
  icon: Zap, accentColor: "amber",
  fields: [
    { key: "name", label: "Model Name", type: "text", required: true },
    { key: "size", label: "Size", type: "text" },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "name", label: "Model", sortable: true },
    { key: "size", label: "Size" }, { key: "ctx", label: "Context" },
    { key: "latencyMs", label: "Latency (ms)" }, { key: "tps", label: "Tokens/s" },
  ],
  idField: "id", searchFields: ["name"],
  apiBase: "/api/db/anomaly-models",
};
export default function OllamaLLMWorkspace() { return <CrudWorkspace config={config} />; }
