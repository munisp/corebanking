import CrudWorkspace from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

export default function ChequeClearingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "cheque-clearing",
        title: "Cheque Clearing",
        subtitle: "Cheque books, MICR processing, clearing house submission, settlement and returns",
        icon: FileText,
        accentColor: "text-slate-600",
        idField: "id",
        statusField: "clearingStatus",
        searchFields: ["chequeNumber", "drawerName", "payeeName", "drawerAccount"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "chequeNumber", label: "Cheque #", sortable: true },
          { key: "drawerName", label: "Drawer", sortable: true },
          { key: "payeeName", label: "Payee", sortable: true },
          { key: "amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "presentedAt", label: "Presented", sortable: true },
          { key: "clearingStatus", label: "Status" },
          { key: "returnReason", label: "Return Reason" },
          { key: "presentingBank", label: "Presenting Bank" },
        ],
        fields: [
          { key: "chequeNumber", label: "Cheque Number", type: "text", required: true },
          { key: "drawerAccount", label: "Drawer Account", type: "text", required: true },
          { key: "payeeName", label: "Payee Name", type: "text", required: true },
          { key: "amount", label: "Amount (₦)", type: "number", required: true, min: 1 },
          { key: "presentingBank", label: "Presenting Bank", type: "text", required: true },
        ],
        actions: [
          { label: "Clear", key: "clear", variant: "default", condition: (r) => r.clearingStatus === "presented" },
          { label: "Return", key: "return", variant: "destructive", condition: (r) => r.clearingStatus === "presented" },
        ],
      }}
    />
  );
}
