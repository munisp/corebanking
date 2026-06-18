import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { MessageCircle } from "lucide-react";

const config: CrudConfig = {
  domainKey: "branded-comms",
  title: "Branded Communications",
  subtitle: "Tenant-branded email, SMS, push notifications, and PDF document generation",
  icon: MessageCircle,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "tenantId", label: "Tenant", sortable: true },
    { key: "templateName", label: "Template", sortable: true },
    { key: "recipient", label: "Recipient", sortable: false },
    { key: "subject", label: "Subject", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "brandedFrom", label: "Branded From", sortable: false },
  ],
  idField: "id",
  searchFields: ["id", "tenantId", "templateName", "recipient"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function BrandedCommsWorkspace() {
  return <CrudWorkspace config={config} />;
}
