import { CreditCard } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "payments-hub",
  title: "Payments Hub",
  subtitle: "NIP transfers, USSD, QR payments, bill payments, international remittance",
  icon: CreditCard,
  accentColor: "bg-blue-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "paymentType", "sourceAccount", "destAccount", "billerName", "nipRef"],
  apiBase: "/api/db/settlements",
  fields: [
    { key: "paymentType", label: "Payment Type", type: "select", options: ["nip", "ussd", "qr", "bill", "remittance"], required: true },
    { key: "sourceAccount", label: "Source Account", type: "text", required: true },
    { key: "destAccount", label: "Destination Account", type: "text" },
    { key: "amount", label: "Amount (₦)", type: "number", required: true },
    { key: "channel", label: "Channel", type: "select", options: ["mobile", "internet", "ussd", "pos", "atm"] },
  ],
  columns: [
    { key: "id", label: "Payment ID" },
    { key: "paymentType", label: "Type", render: (v) => String(v).toUpperCase() },
    { key: "amount", label: "Amount", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "fee", label: "Fee", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "channel", label: "Channel" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Reverse", key: "reverse", condition: (r) => r.status === "completed" },
  ],
};

export default function PaymentsHubWorkspace() {
  return <CrudWorkspace config={config} />;
}
