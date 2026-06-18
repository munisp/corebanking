import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Search } from "lucide-react";

const config: CrudConfig = {
  domainKey: "adverse-media-scanner",
  title: "Adverse Media Deep Scanner",
  subtitle: "NLP-based negative news analysis (Nigerian + intl sources)",
  icon: Search,
  accentColor: "orange",
  apiBase: "/api/db/adverse-media-scans",
  idField: "id",
  statusField: "status",
  searchFields: ["customerId"],
  fields: [
    { key: "customerId", label: "Customer ID", type: "text" },
    { key: "customerName", label: "Customer", type: "text" },
    { key: "relevantArticles", label: "Relevant Articles", type: "number" },
    { key: "sentiment", label: "Sentiment", type: "text" },
    { key: "riskImpact", label: "Risk Impact", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "customerId", label: "Customer ID" },
    { key: "customerName", label: "Customer" },
    { key: "relevantArticles", label: "Relevant Articles" },
    { key: "sentiment", label: "Sentiment" },
    { key: "riskImpact", label: "Risk Impact" },
    { key: "status", label: "Status" }
  ],
};

export default function AdverseMediaScannerWorkspace() {
  return <CrudWorkspace config={config} />;
}
