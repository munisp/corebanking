import CrudWorkspace from "@/components/CrudWorkspace";
import { MessageSquare } from "lucide-react";

export default function ChatbotWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "chatbot",
        title: "AI Chatbot",
        subtitle: "NLP intents, conversation management, escalation (Python :8179)",
        icon: MessageSquare,
        accentColor: "text-purple-700",
        idField: "id",
        statusField: "status",
        searchFields: ["intent", "category"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Intent ID" },
          { key: "intent", label: "Intent", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "confidence_threshold", label: "Threshold", sortable: true },
          { key: "responses", label: "Responses", sortable: true },
          { key: "avg_confidence", label: "Confidence", sortable: true },
          { key: "escalation_rate", label: "Escalation %", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
