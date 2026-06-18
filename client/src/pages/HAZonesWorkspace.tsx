import CrudWorkspace from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

export default function HAZonesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "hazones",
        title: "HA Zones",
        subtitle: "Multi-zone deployment — Lagos, Abuja, London with traffic routing and latency monitoring",
        icon: Globe,
        accentColor: "text-blue-700",
        idField: "zone",
        statusField: "status",
        searchFields: ["zone", "region"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "zone", label: "Zone", sortable: true },
          { key: "region", label: "Region", sortable: true },
          { key: "services", label: "Services" },
          { key: "replicas", label: "Replicas" },
          { key: "traffic", label: "Traffic", sortable: true },
          { key: "latencyMs", label: "Latency ms" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
