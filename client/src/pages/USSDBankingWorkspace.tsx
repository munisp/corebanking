import CrudWorkspace from "@/components/CrudWorkspace";
import { Phone } from "lucide-react";

export default function USSDBankingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "ussd-banking",
        title: "USSD Banking",
        subtitle: "USSD sessions, menu tree, multi-language support for Nigerian telcos",
        icon: Phone,
        accentColor: "text-teal-700",
        idField: "id",
        statusField: "status",
        searchFields: ["msisdn", "menu"],
        apiBase: "/api/db/ussd-banking-gateway",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "msisdn", label: "Phone Number", sortable: true },
          { key: "shortCode", label: "Short Code" },
          { key: "menu", label: "Menu", sortable: true },
          { key: "language", label: "Language", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
