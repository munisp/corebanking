import CrudWorkspace from "@/components/CrudWorkspace";
import { ArrowRightLeft } from "lucide-react";

export default function MojaloopTBBridgeEntriesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojalooptbbridgeentries",
        title: "Mojaloop — TB Bridge Entries",
        subtitle: "TigerBeetle ledger bridging — every Mojaloop transfer auto-posted to TigerBeetle position accounts",
        icon: ArrowRightLeft,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "mojaloopTransferId", "direction"],
        apiBase: "/api/db/settlements",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "mojaloopTransferId", label: "Mojaloop ID" },
          { key: "direction", label: "Direction", sortable: true },
          { key: "debitAccount", label: "Debit" },
          { key: "creditAccount", label: "Credit" },
          { key: "amount", label: "Amount", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "latencyMs", label: "Latency ms", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
