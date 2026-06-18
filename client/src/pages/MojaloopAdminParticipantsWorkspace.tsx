import CrudWorkspace from "@/components/CrudWorkspace";
import { Users } from "lucide-react";

export default function MojaloopAdminParticipantsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojaloopadminparticipants",
        title: "Mojaloop — Admin — Participants",
        subtitle: "Participant onboarding and management — DFSPs, PISPs, AISPs with NDC limits and endpoints",
        icon: Users,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["fspId", "name", "country", "type"],
        apiBase: "/api/db/settlements",
        pageSize: 25,
        columns: [
          { key: "fspId", label: "FSP ID", sortable: true },
          { key: "name", label: "Name", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "country", label: "Country", sortable: true },
          { key: "region", label: "Region", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "ndcLimit", label: "NDC Limit", sortable: true },
          { key: "endpoints", label: "Endpoints" },
        ],
        fields: [],
      }}
    />
  );
}
