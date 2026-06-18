import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function MojaloopILPPacketsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojaloopilppackets",
        title: "Mojaloop — ILP Packets",
        subtitle: "Interledger Protocol packet handling — cryptographic conditions, fulfilments, verification",
        icon: Shield,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "transferId", "payerFsp", "payeeFsp"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "transferId", label: "Transfer ID" },
          { key: "currency", label: "Currency", sortable: true },
          { key: "amount", label: "Amount", sortable: true },
          { key: "payerFsp", label: "Payer" },
          { key: "payeeFsp", label: "Payee" },
          { key: "status", label: "Status", sortable: true },
          { key: "verificationResult", label: "Verified", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
