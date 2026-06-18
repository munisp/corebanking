import CrudWorkspace from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

export default function MojaloopCorridorsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojaloopcorridors",
        title: "Mojaloop — Cross-Border Corridors",
        subtitle: "Pan-African interoperability — ECOWAS, WAEMU, SADC, EAC corridors with FX rates and compliance",
        icon: Globe,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "region", "sourceCountry", "destCountry"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "region", label: "Region", sortable: true },
          { key: "sourceCurrency", label: "From", sortable: true },
          { key: "destCurrency", label: "To", sortable: true },
          { key: "exchangeRate", label: "FX Rate", sortable: true },
          { key: "dailyVolume", label: "Volume", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
