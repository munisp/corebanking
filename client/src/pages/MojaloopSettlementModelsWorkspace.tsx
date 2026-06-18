import CrudWorkspace from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

export default function MojaloopSettlementModelsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojaloopsettlementmodels",
        title: "Mojaloop — Settlement Models",
        subtitle: "Settlement model configuration — DNS, RTGS, cross-border with granularity and delay settings",
        icon: Layers,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "name",
        searchFields: ["id", "name", "currency"],
        apiBase: "/api/db/settlements",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "settlementGranularity", label: "Granularity", sortable: true },
          { key: "settlementInterchange", label: "Interchange" },
          { key: "settlementDelay", label: "Delay", sortable: true },
          { key: "currency", label: "Currency" },
          { key: "isActive", label: "Active" },
        ],
        fields: [],
      }}
    />
  );
}
