import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

const config: CrudConfig = {
  domainKey: "whatsapp-document-service",
  title: "WhatsApp Document Service",
  subtitle: "Statement PDF delivery and KYC document collection via WhatsApp",
  icon: FileText,
  accentColor: "blue",
  apiBase: "/api/db/whatsapp-document-service",
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

export default function WhatsappDocumentServiceWorkspace() {
  return <CrudWorkspace config={config} />;
}
