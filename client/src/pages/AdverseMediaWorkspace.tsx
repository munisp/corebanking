import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";
const config: CrudConfig = {
  domainKey: "adverse-media", title: "Adverse Media Screening",
  subtitle: "Nigerian newspaper scanning (Punch, Guardian, ThisDay, Vanguard), EFCC/ICPC court records, social media NLP sentiment analysis.",
  icon: FileText, accentColor: "red",
  fields: [
    { key: "entity", label: "Entity Name", type: "text", required: true },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "entity", label: "Entity", sortable: true },
    { key: "source", label: "Source" }, { key: "headline", label: "Headline" },
    { key: "riskImpact", label: "Risk Impact", sortable: true }, { key: "detectedAt", label: "Detected" },
  ],
  idField: "id", statusField: "riskImpact", searchFields: ["entity", "source", "headline"],
  apiBase: "/api/db/accounts",
};
export default function AdverseMediaWorkspace() { return <CrudWorkspace config={config} />; }
