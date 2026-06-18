import { Heart } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "customer-engagement",
  title: "Customer Engagement",
  subtitle: "In-app messaging, product recommendations, NPS surveys, referral program",
  icon: Heart,
  accentColor: "bg-pink-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "referrer_id", "referee_name", "referee_phone"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "referrer_id", label: "Referrer Customer ID", type: "text", required: true },
    { key: "referee_name", label: "Referee Name", type: "text", required: true },
    { key: "referee_phone", label: "Referee Phone", type: "text", required: true, placeholder: "+234..." },
    { key: "referee_email", label: "Referee Email", type: "text" },
  ],
  columns: [
    { key: "id", label: "Referral ID" },
    { key: "referrer_id", label: "Referrer" },
    { key: "referee_name", label: "Referee" },
    { key: "referee_phone", label: "Phone" },
    { key: "reward_amount", label: "Reward", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Contact", key: "contact", condition: (r) => r.status === "pending" },
    { label: "Convert", key: "convert", condition: (r) => r.status === "contacted" || r.status === "registered" },
    { label: "Pay Reward", key: "pay_reward", condition: (r) => r.status === "converted" },
  ],
};

export default function CustomerEngagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
