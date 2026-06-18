import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Calendar } from "lucide-react";

const config: CrudConfig = {
  domainKey: "cooperative-meetings",
  title: "Cooperative Meeting Management",
  subtitle: "Attendance tracking, minutes, decisions and election voting",
  icon: Calendar,
  accentColor: "indigo",
  apiBase: "/api/db/cooperative-meetings",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Meeting Type" },
    { key: "amount", label: "Attendees" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function CooperativeMeetingsWorkspace() {
  return <CrudWorkspace config={config} />;
}
