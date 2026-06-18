import CrudWorkspace from "@/components/CrudWorkspace";
import { Settings } from "lucide-react";

export default function MojaloopTBBridgeConfigsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojalooptbbridgeconfigs",
        title: "Mojaloop — TB Bridge Configs",
        subtitle: "TigerBeetle bridge configuration — account patterns, ledger mapping, auto-post and reconciliation rules",
        icon: Settings,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "name",
        searchFields: ["id", "name", "transferType"],
        apiBase: "/api/db/settlements",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "transferType", label: "Type", sortable: true },
          { key: "debitAccountPattern", label: "Debit Pattern" },
          { key: "creditAccountPattern", label: "Credit Pattern" },
          { key: "ledger", label: "Ledger" },
          { key: "autoPost", label: "Auto-Post" },
        ],
        fields: [],
      }}
    />
  );
}
