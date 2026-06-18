import CrudWorkspace from "@/components/CrudWorkspace";
import { Search } from "lucide-react";

export default function PaymentInvestigationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "payment-investigation",
        title: "Payment Investigation",
        subtitle: "SWIFT gpi, NIP/NEFT/RTGS trace, returns (Go :8176)",
        icon: Search,
        accentColor: "text-yellow-700",
        idField: "id",
        statusField: "status",
        searchFields: ["original_ref", "payment_type"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Case ID" },
          { key: "original_ref", label: "Payment Ref", sortable: true },
          { key: "payment_type", label: "Type", sortable: true },
          { key: "amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "sender_bank", label: "Sender", sortable: true },
          { key: "receiver_bank", label: "Receiver", sortable: true },
          { key: "reason", label: "Reason", sortable: true },
          { key: "priority", label: "Priority", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
