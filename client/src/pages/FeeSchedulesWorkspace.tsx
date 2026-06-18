import CrudWorkspace from "@/components/CrudWorkspace";
import { Receipt } from "lucide-react";

export default function FeeSchedulesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "fee-schedules",
        title: "Fee Schedules",
        subtitle: "NIP, USSD, RTGS, POS, LC — flat, tiered, capped pricing with VAT",
        icon: Receipt,
        accentColor: "text-lime-700",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "product", "channel", "customerTier"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Fee Name", sortable: true },
          { key: "product", label: "Product", sortable: true },
          { key: "channel", label: "Channel" },
          { key: "feeType", label: "Type", sortable: true },
          { key: "flatAmount", label: "Flat (₦)", render: (v) => v ? `₦${v}` : "—" },
          { key: "percentage", label: "%", render: (v) => v ? `${v}%` : "—" },
          { key: "cap", label: "Cap (₦)", render: (v) => v ? `₦${Number(v).toLocaleString()}` : "—" },
          { key: "vatApplicable", label: "VAT", render: (v) => v ? "Yes" : "No" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [
          { key: "name", label: "Fee Name", type: "text", required: true },
          { key: "product", label: "Product", type: "text", required: true },
          { key: "feeType", label: "Type", type: "select", options: ["flat", "percentage", "tiered", "capped"], required: true },
        ],
      }}
    />
  );
}
