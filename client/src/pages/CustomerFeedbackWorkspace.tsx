import CrudWorkspace from "@/components/CrudWorkspace";
import { Star } from "lucide-react";

export default function CustomerFeedbackWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "customer-feedback",
        title: "Customer Feedback & NPS",
        subtitle: "Surveys, ratings, sentiment analysis, NPS trending, branch scoring (Python :8155)",
        icon: Star,
        accentColor: "text-yellow-600",
        idField: "id",
        statusField: "sentiment",
        searchFields: ["customer_name", "channel", "category", "comment"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customer_name", label: "Customer", sortable: true },
          { key: "channel", label: "Channel", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "rating", label: "Rating", sortable: true, render: (v) => "★".repeat(Number(v)) },
          { key: "nps_score", label: "NPS", sortable: true },
          { key: "sentiment", label: "Sentiment", sortable: true },
          { key: "comment", label: "Comment" },
          { key: "resolved", label: "Resolved", render: (v) => v ? "Yes" : "No" },
          { key: "submitted_at", label: "Date", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
