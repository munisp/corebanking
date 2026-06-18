import CrudWorkspace from "@/components/CrudWorkspace";
import { Clock } from "lucide-react";

export default function MojaloopSettlementWindowsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojaloopsettlementwindows",
        title: "Mojaloop — Settlement Windows",
        subtitle: "Settlement window lifecycle — open, close, settle with net position calculation per FSP",
        icon: Clock,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "state",
        searchFields: ["id", "state", "reason"],
        apiBase: "/api/db/settlements",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "state", label: "State", sortable: true },
          { key: "reason", label: "Reason" },
          { key: "transferCount", label: "Transfers", sortable: true },
          { key: "totalAmount", label: "Total Amount", sortable: true },
          { key: "currency", label: "Currency", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
