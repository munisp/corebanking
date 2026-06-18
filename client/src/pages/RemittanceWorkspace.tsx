import CrudWorkspace from "@/components/CrudWorkspace";
import { Send } from "lucide-react";

export default function RemittanceWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "remittance",
        title: "Remittance",
        subtitle: "Inbound/outbound corridors, FX, agent networks (Go :8181)",
        icon: Send,
        accentColor: "text-green-700",
        idField: "id",
        statusField: "status",
        searchFields: ["corridor", "sender_name"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "Txn ID" },
          { key: "corridor", label: "Corridor", sortable: true },
          { key: "sender_name", label: "Sender", sortable: true },
          { key: "receiver_name", label: "Receiver", sortable: true },
          { key: "send_amount", label: "Send", sortable: true },
          { key: "send_currency", label: "CCY" },
          { key: "receive_amount", label: "Receive (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "fx_rate", label: "FX Rate", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
