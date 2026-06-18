import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Key } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sms-otp-service",
  title: "SMS OTP Service",
  subtitle: "Time-based OTP delivery via MTN, Glo, Airtel, 9mobile",
  icon: Key,
  accentColor: "red",
  apiBase: "/api/db/sms-otp-service",
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

export default function SmsOtpServiceWorkspace() {
  return <CrudWorkspace config={config} />;
}
