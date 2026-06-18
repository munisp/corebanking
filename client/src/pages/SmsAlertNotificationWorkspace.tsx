import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { AlertCircle } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sms-alert-notification",
  title: "SMS Alert Notification",
  subtitle: "Transaction alerts, loan reminders and fraud notifications",
  icon: AlertCircle,
  accentColor: "slate",
  apiBase: "/api/db/sms-alert-notification",
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

export default function SmsAlertNotificationWorkspace() {
  return <CrudWorkspace config={config} />;
}
