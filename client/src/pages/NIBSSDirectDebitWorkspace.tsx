import CrudWorkspace from "@/components/CrudWorkspace";
import { CreditCard } from "lucide-react";

export default function NIBSSDirectDebitWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "nibss-direct-debit",
        title: "NIBSS Direct Debit",
        subtitle: "Mandate management, debit instructions, settlement, and NIBSS integration",
        icon: CreditCard,
        accentColor: "text-green-700",
        idField: "id",
        statusField: "status",
        searchFields: ["mandateRef", "customerID", "creditorName", "nibssRef"],
        apiBase: "/api/db/nip-transactions",
        pageSize: 25,
        columns: [
          { key: "mandateRef", label: "Mandate Ref", sortable: true },
          { key: "customerID", label: "Customer", sortable: true },
          { key: "creditorName", label: "Creditor", sortable: true },
          { key: "maxAmount", label: "Max Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "frequency", label: "Frequency" },
          { key: "startDate", label: "Start Date", sortable: true },
          { key: "status", label: "Status" },
          { key: "nibssRef", label: "NIBSS Ref" },
        ],
        fields: [
          { key: "customerId", label: "Customer ID", type: "text", required: true },
          { key: "accountNumber", label: "Account Number", type: "text", required: true },
          { key: "bankCode", label: "Bank Code", type: "text", required: true },
          { key: "creditorName", label: "Creditor Name", type: "text", required: true },
          { key: "creditorAccount", label: "Creditor Account", type: "text", required: true },
          { key: "creditorBankCode", label: "Creditor Bank Code", type: "text", required: true },
          { key: "maxAmount", label: "Max Amount (₦)", type: "number", required: true, min: 1 },
          { key: "frequency", label: "Frequency", type: "select", options: ["weekly", "monthly", "quarterly", "annually"], required: true },
          { key: "startDate", label: "Start Date", type: "date", required: true },
        ],
        actions: [
          { label: "Cancel", key: "cancel", variant: "destructive", condition: (r) => r.status === "active" },
        ],
      }}
    />
  );
}
