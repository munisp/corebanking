import CrudWorkspace from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

export default function TBPGBalanceCacheEntriesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "tbpgbalancecacheentries",
        title: "Balance Cache Entries",
        subtitle: "Cached account balances — available, ledger, hold amounts from TigerBeetle via Redis",
        icon: Database,
        accentColor: "text-blue-700",
        idField: "accountId",
        statusField: "currency",
        searchFields: ["accountId", "accountName", "currency"],
        apiBase: "/api/db/tb-batch-configs",
        pageSize: 25,
        columns: [
          { key: "accountId", label: "Account ID", sortable: true },
          { key: "accountName", label: "Name" },
          { key: "availableBalance", label: "Available", sortable: true },
          { key: "ledgerBalance", label: "Ledger", sortable: true },
          { key: "holdAmount", label: "Hold" },
          { key: "currency", label: "Ccy", sortable: true },
          { key: "hitRate", label: "Hit Rate", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
