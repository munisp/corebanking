import CrudWorkspace from "@/components/CrudWorkspace";
import { Lock } from "lucide-react";

export default function CollateralWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "collateral",
        title: "Collateral Management",
        subtitle: "Pledges, valuations, liens — property, securities, equipment, guarantees",
        icon: Lock,
        accentColor: "text-stone-700",
        idField: "id",
        statusField: "status",
        searchFields: ["description", "ownerName", "type", "registrationRef"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type", sortable: true },
          { key: "description", label: "Description" },
          { key: "ownerName", label: "Owner", sortable: true },
          { key: "marketValue", label: "Market Value", sortable: true, render: (v) => `₦${(Number(v) / 1e6).toFixed(0)}M` },
          { key: "forcedSaleValue", label: "FSV", render: (v) => `₦${(Number(v) / 1e6).toFixed(0)}M` },
          { key: "haircut", label: "Haircut %", render: (v) => `${v}%` },
          { key: "coverageRatio", label: "Coverage %", sortable: true, render: (v) => `${v}%` },
          { key: "status", label: "Status", sortable: true },
          { key: "insured", label: "Insured", render: (v) => v ? "Yes" : "No" },
        ],
        fields: [],
      }}
    />
  );
}
