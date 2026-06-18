import CrudWorkspace from "@/components/CrudWorkspace";
import { ArrowRightLeft } from "lucide-react";

export default function PaymentTransactionsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "payment-transactions",
        title: "Payment Transactions",
        subtitle: "NIP, NEFT, RTGS, internal transfers — real-time status and fee tracking",
        icon: ArrowRightLeft,
        accentColor: "text-green-600",
        idField: "id",
        statusField: "status",
        searchFields: ["reference", "sourceAccount", "destinationAccount", "narration", "type"],
        apiBase: "/api/db/transactions",
        pageSize: 25,
        columns: [
          { key: "reference", label: "Reference", sortable: true },
          { key: "type", label: "Channel", sortable: true },
          { key: "sourceAccount", label: "From" },
          { key: "destinationBank", label: "To Bank" },
          { key: "amount", label: "Amount (₦)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "fee", label: "Fee", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status" },
          { key: "initiatedAt", label: "Date", sortable: true },
        ],
        fields: [
          { key: "type", label: "Channel", type: "select", options: ["nip", "neft", "rtgs", "internal", "ussd", "pos"], required: true },
          { key: "sourceAccount", label: "Source Account", type: "text", required: true },
          { key: "destinationAccount", label: "Destination Account", type: "text", required: true },
          { key: "amount", label: "Amount", type: "number", required: true },
          { key: "narration", label: "Narration", type: "text", required: true },
        ],
      }}
    />
  );
}
