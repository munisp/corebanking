import CrudWorkspace from "@/components/CrudWorkspace";
import { Moon } from "lucide-react";

export default function DormancyWorkspace() {
  return (
    <CrudWorkspace
      hideCreate
      config={{
        domainKey: "dormancy",
        title: "Account Dormancy",
        subtitle: "CBN dormancy management — inactive, dormant, unclaimed balance tracking",
        icon: Moon,
        accentColor: "text-amber-700",
        idField: "id",
        statusField: "dormancy_stage",
        searchFields: ["account_number", "account_name", "branch"],
        apiBase: "/dormancy/v1/dormant-accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "account_number", label: "Account No" },
          { key: "account_name", label: "Customer", sortable: true },
          { key: "account_type", label: "Type" },
          { key: "balance", label: "Balance", sortable: true, render: (v, row) => `${row.currency} ${Number(v).toLocaleString()}` },
          { key: "days_inactive", label: "Days Inactive", sortable: true },
          { key: "last_transaction_date", label: "Last Txn" },
          { key: "dormancy_stage", label: "Stage", sortable: true },
          { key: "restriction_level", label: "Restriction" },
          { key: "notifications_sent", label: "Notices Sent" },
          { key: "reactivation_eligible", label: "Reactivation", render: (v) => v ? "Eligible" : "Ineligible" },
          { key: "flagged_for_cbn_sweep", label: "CBN Sweep", render: (v) => v ? "Flagged" : "—" },
          { key: "branch", label: "Branch" },
        ],
        fields: [
          { key: "id", label: "ID", type: "readonly" },
          { key: "account_number", label: "Account Number", type: "readonly" },
          { key: "account_name", label: "Account Name", type: "readonly" },
          { key: "dormancy_stage", label: "Dormancy Stage", type: "select", options: ["active", "inactive", "dormant", "unclaimed"] },
          { key: "restriction_level", label: "Restriction Level", type: "select", options: ["none", "alert_only", "debit_restricted", "fully_restricted"] },
          { key: "reactivation_eligible", label: "Reactivation Eligible", type: "boolean" },
          { key: "flagged_for_cbn_sweep", label: "Flagged for CBN Sweep", type: "boolean" },
        ],
        actions: [
          { label: "Reactivate", key: "reactivate", condition: (r) => r.reactivation_eligible === true },
          { label: "Notify", key: "notify" },
        ],
      }}
    />
  );
}
