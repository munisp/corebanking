import { Users } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "esusu-groups",
  title: "Esusu Groups",
  subtitle: "Rotating savings and credit — ajo/adashe/isusu group management",
  icon: Users,
  accentColor: "bg-orange-600",
  idField: "id",
  statusField: "status",
  searchFields: ["name", "groupId"],
  apiBase: "/api/db/esusu-groups",
  fields: [
    { key: "name", label: "Group Name", type: "text", required: true, placeholder: "e.g. Market Women Ajo" },
    { key: "contributionAmount", label: "Contribution Amount (₦)", type: "number", required: true },
    { key: "frequencyDays", label: "Frequency (Days)", type: "select", options: ["7", "14", "30"], required: true },
  ],
  columns: [
    { key: "groupId", label: "Group ID" },
    { key: "name", label: "Name" },
    { key: "contributionAmount", label: "Contribution", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "memberCount", label: "Members" },
    { key: "currentRound", label: "Round" },
    { key: "frequencyDays", label: "Cycle", render: (v) => `${v} days` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Activate", key: "activate", condition: (r) => r.status === "forming" },
  ],
};

export default function EsusuWorkspace() {
  return <CrudWorkspace config={config} />;
}
