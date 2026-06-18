import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";
const config: CrudConfig = {
  domainKey: "i18n-service", title: "i18n Localization",
  subtitle: "5 languages (English, Hausa, Yoruba, Igbo, Pidgin) — 2400 translation keys.",
  icon: Globe, accentColor: "teal",
  fields: [
    { key: "id", label: "ID", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["active", "inactive", "pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/anomaly-models",
};
export default function I18nServiceWorkspace() { return <CrudWorkspace config={config} />; }
