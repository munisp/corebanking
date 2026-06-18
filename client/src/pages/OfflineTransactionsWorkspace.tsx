import CrudWorkspace from "@/components/CrudWorkspace";
import { WifiOff } from "lucide-react";

export default function OfflineTransactionsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "offline-transactions",
        title: "Offline Transactions",
        subtitle: "CRDT-based offline queue, Ed25519 signed, 72-hour window, delta sync",
        icon: WifiOff,
        accentColor: "text-teal-700",
        idField: "id",
        statusField: "status",
        searchFields: ["type", "deviceId"],
        apiBase: "/api/db/transactions",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type", sortable: true },
          { key: "amount", label: "Amount", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "deviceId", label: "Device", sortable: true },
          { key: "signatureValid", label: "Signed" },
        ],
        fields: [],
      }}
    />
  );
}
