import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ArrowUpRight } from "lucide-react";

const config: CrudConfig = {
  domainKey: "egress-controller",
  title: "Egress Controller",
  subtitle: "Service egress traffic control",
  icon: ArrowUpRight,
  accentColor: "teal",
  apiBase: "/api/db/egress-policies",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "domains", label: "Domains", type: "text" },
    { key: "protocol", label: "Protocol", type: "text" },
    { key: "allowed", label: "Allowed", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "domains", label: "Domains" },
    { key: "protocol", label: "Protocol" },
    { key: "allowed", label: "Allowed" },
    { key: "status", label: "Status" }
  ],
};

export default function EgressControllerWorkspace() {
  return <CrudWorkspace config={config} />;
}
