import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Cpu } from "lucide-react";

const config: CrudConfig = {
  domainKey: "ussd-sim-toolkit",
  title: "USSD SIM Toolkit",
  subtitle: "STK push for proactive banking alerts and payment reminders",
  icon: Cpu,
  accentColor: "violet",
  apiBase: "/api/db/ussd-sim-toolkit",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" }
  ],
};

export default function UssdSimToolkitWorkspace() {
  return <CrudWorkspace config={config} />;
}
