import CrudWorkspace from "@/components/CrudWorkspace";
import { Banknote } from "lucide-react";

export default function MoneyMarketWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "money-market",
        title: "Money Market",
        subtitle: "Interbank placements, call deposits, repos, treasury bills, commercial paper (Rust :8156)",
        icon: Banknote,
        accentColor: "text-emerald-600",
        idField: "id",
        statusField: "status",
        searchFields: ["counterparty", "instrument_type", "currency"],
        apiBase: "/api/db/fx-trades",
        pageSize: 25,
        columns: [
          { key: "id", label: "Deal ID" },
          { key: "instrument_type", label: "Instrument", sortable: true },
          { key: "counterparty", label: "Counterparty", sortable: true },
          { key: "principal", label: "Principal (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "rate", label: "Rate %", sortable: true },
          { key: "tenor_days", label: "Tenor (days)", sortable: true },
          { key: "maturity_date", label: "Maturity", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "accrued_interest", label: "Accrued Interest", render: (v) => `₦${Number(v).toLocaleString()}` },
        ],
        fields: [],
      }}
    />
  );
}
