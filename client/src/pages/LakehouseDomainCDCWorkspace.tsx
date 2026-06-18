import CrudWorkspace from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

export default function LakehouseDomainCDCWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "lakehousedomaincdc",
        title: "Lakehouse Domain CDC",
        subtitle: "Banking domain CDC event publishing — Core Banking, Payments, Lending, Treasury, GL, KYC/AML, Fraud, Cards, Trade Finance, Regulatory",
        icon: Database,
        accentColor: "text-emerald-700",
        idField: "domain",
        statusField: "domain",
        searchFields: ["domain"],
        apiBase: "/api/db/avro-schemas",
        pageSize: 25,
        columns: [
          { key: "domain", label: "Domain", sortable: true },
          { key: "avgEventsPerDay", label: "Events/Day", sortable: true },
          { key: "avgPayloadBytes", label: "Payload Bytes" },
        ],
        fields: [],
      }}
    />
  );
}
