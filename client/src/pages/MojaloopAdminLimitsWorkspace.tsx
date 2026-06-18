import CrudWorkspace from "@/components/CrudWorkspace";
import { Gauge } from "lucide-react";

export default function MojaloopAdminLimitsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojaloopadminlimits",
        title: "Mojaloop — Admin — Limits",
        subtitle: "Participant transfer limits — NDC, single transfer max, daily/monthly caps with utilization tracking",
        icon: Gauge,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "fspId", "limitType"],
        apiBase: "/api/db/settlements",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "fspId", label: "FSP ID", sortable: true },
          { key: "limitType", label: "Type", sortable: true },
          { key: "value", label: "Limit", sortable: true },
          { key: "currentUsage", label: "Usage", sortable: true },
          { key: "utilizationPct", label: "Util %", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
