import CrudWorkspace from "@/components/CrudWorkspace";
import { Send } from "lucide-react";

export default function SWIFTMessagesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "swift-messages",
        title: "SWIFT Message Center",
        subtitle: "MT103, MT202, MT760, MT940 — send, receive, track with GPI",
        icon: Send,
        accentColor: "text-sky-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "messageType", "reference", "senderBIC", "receiverBIC", "beneficiary"],
        apiBase: "/api/db/swift-messages",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "messageType", label: "Type", sortable: true },
          { key: "direction", label: "Dir", sortable: true },
          { key: "reference", label: "Reference" },
          { key: "senderBIC", label: "Sender" },
          { key: "receiverBIC", label: "Receiver" },
          { key: "amount", label: "Amount", sortable: true, render: (v, row) => v ? `${row.currency} ${Number(v).toLocaleString()}` : "—" },
          { key: "status", label: "Status", sortable: true },
          { key: "createdAt", label: "Created", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
