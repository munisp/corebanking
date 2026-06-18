import CrudWorkspace from "@/components/CrudWorkspace";
import { Moon } from "lucide-react";

export default function DormancyWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "dormancy",
        title: "Account Dormancy",
        subtitle: "CBN dormancy management — inactive, dormant, unclaimed balance tracking",
        icon: Moon,
        accentColor: "text-amber-700",
        idField: "id",
        statusField: "dormancyStage",
        searchFields: ["accountNumber", "accountName", "branch"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "accountNumber", label: "Account No" },
          { key: "accountName", label: "Customer", sortable: true },
          { key: "accountType", label: "Type" },
          { key: "balance", label: "Balance", sortable: true, render: (v, row) => `${row.currency} ${Number(v).toLocaleString()}` },
          { key: "daysInactive", label: "Days", sortable: true },
          { key: "dormancyStage", label: "Stage", sortable: true },
          { key: "notificationsSent", label: "Notices Sent" },
          { key: "reactivationEligible", label: "Reactivation", render: (v) => v ? "Eligible" : "Ineligible" },
          { key: "branch", label: "Branch" },
        ],
        fields: [],
      }}
    />
  );
}
