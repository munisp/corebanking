import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ScanLine } from "lucide-react";

const config: CrudConfig = {
  domainKey: "cheque-imaging",
  title: "Cheque Imaging",
  subtitle: "Digital cheque truncation with MICR/OCR processing",
  icon: ScanLine,
  accentColor: "purple",
  idField: "id",
  searchFields: ["chequeNumber", "drawerName", "payeeName", "clearingStatus"],
  apiBase: "/api/db/accounts",
  columns: [
    { key: "id", label: "Image ID", sortable: true },
    { key: "chequeNumber", label: "Cheque #", sortable: true },
    { key: "drawerName", label: "Drawer", sortable: true },
    { key: "payeeName", label: "Payee", sortable: true },
    { key: "amount", label: "Amount (₦)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "ocrConfidence", label: "OCR %", sortable: true, render: (v) => `${Math.round(Number(v) * 100)}%` },
    { key: "clearingStatus", label: "Status", sortable: true },
    { key: "clearingCycle", label: "Cycle", sortable: true },
  ],
  fields: [
    { key: "chequeNumber", label: "Cheque Number", type: "text", required: true },
    { key: "bankCode", label: "Bank Code", type: "text", required: true },
    { key: "accountNumber", label: "Account Number", type: "text", required: true },
    { key: "amount", label: "Amount", type: "number", required: true },
    { key: "drawerName", label: "Drawer Name", type: "text", required: true },
    { key: "payeeName", label: "Payee Name", type: "text", required: true },
    { key: "clearingStatus", label: "Status", type: "select", options: ["pending", "cleared", "returned", "manual_review"] },
  ],
};

export default function ChequeImagingWorkspace() {
  return <CrudWorkspace config={config} />;
}
