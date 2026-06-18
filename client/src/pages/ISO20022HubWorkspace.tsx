import CrudWorkspace from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

export default function ISO20022HubWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "iso20022-hub",
        title: "ISO 20022 Hub",
        subtitle: "Message parsing, validation, pacs.008/pacs.004/pain.001/camt.053 — standards compliance (Rust :8162)",
        icon: FileText,
        accentColor: "text-indigo-600",
        idField: "id",
        statusField: "validation_status",
        searchFields: ["message_type", "sender_bic", "receiver_bic"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Message ID" },
          { key: "message_type", label: "Type", sortable: true },
          { key: "sender_bic", label: "Sender BIC", sortable: true },
          { key: "receiver_bic", label: "Receiver BIC", sortable: true },
          { key: "amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "currency", label: "Currency" },
          { key: "validation_status", label: "Validation", sortable: true },
          { key: "created_at", label: "Created", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
