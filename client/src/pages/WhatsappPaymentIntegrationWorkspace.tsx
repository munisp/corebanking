import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { CreditCard } from "lucide-react";

const config: CrudConfig = {
  domainKey: "whatsapp-payment-integration",
  title: "WhatsApp Payment",
  subtitle: "WhatsApp Pay P2P transfers and merchant payments",
  icon: CreditCard,
  accentColor: "teal",
  apiBase: "/api/db/whatsapp-payment-integration",
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

export default function WhatsappPaymentIntegrationWorkspace() {
  return <CrudWorkspace config={config} />;
}
