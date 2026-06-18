import CrudWorkspace from "@/components/CrudWorkspace";
import { ArrowRightLeft } from "lucide-react";

export default function LakehouseLineageEdgesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "lakehouselineageedges",
        title: "Data Lineage Edges",
        subtitle: "Data flow connections — CDC publish, Kafka consume, ETL transform, aggregation, query federation, MV refresh",
        icon: ArrowRightLeft,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "transformType",
        searchFields: ["id", "source", "target", "transformType"],
        apiBase: "/api/db/avro-schemas",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "source", label: "Source", sortable: true },
          { key: "target", label: "Target", sortable: true },
          { key: "transformType", label: "Transform", sortable: true },
          { key: "frequency", label: "Frequency" },
          { key: "avgLatencyMs", label: "Latency ms", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
