import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Smartphone } from "lucide-react";

const config: CrudConfig = {
  domainKey: "interactive-ussd-agri",
  title: "Interactive USSD Agriculture",
  subtitle: "Full session state machine with multilingual support",
  icon: Smartphone,
  accentColor: "violet",
  apiBase: "/api/db/interactive-ussd-agri",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "session_id", label: "Session", type: "text" },
    { key: "msisdn", label: "MSISDN", type: "text" },
    { key: "language", label: "Language", type: "text" },
    { key: "state", label: "State", type: "text" }
  ],
  columns: [
    { key: "session_id", label: "Session" },
    { key: "msisdn", label: "MSISDN" },
    { key: "language", label: "Language" },
    { key: "input", label: "Input" },
    { key: "state", label: "State" }
  ],
};

export default function InteractiveUssdAgriWorkspace() {
  return <CrudWorkspace config={config} />;
}
