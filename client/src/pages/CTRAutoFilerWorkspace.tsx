import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "ctr-auto-filer",
  title: "CTR Auto-Filing Engine",
  subtitle: "Automated ₦5M+ cash transaction reporting to NFIU",
  icon: FileCheck,
  accentColor: "green",
  apiBase: "/api/db/ctr-reports-aml",
  idField: "id",
  statusField: "status",
  searchFields: ["customerId"],
  fields: [
    { key: "customerId", label: "Customer ID", type: "text" },
    { key: "customerName", label: "Customer", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "transactionType", label: "Type", type: "text" },
    { key: "status", label: "Status", type: "text" },
    { key: "autoFiled", label: "Auto Filed", type: "text" }
  ],
  columns: [
    { key: "customerId", label: "Customer ID" },
    { key: "customerName", label: "Customer" },
    { key: "amount", label: "Amount" },
    { key: "transactionType", label: "Type" },
    { key: "status", label: "Status" },
    { key: "autoFiled", label: "Auto Filed" }
  ],
};

export default function CTRAutoFilerWorkspace() {
  return <CrudWorkspace config={config} />;
}
