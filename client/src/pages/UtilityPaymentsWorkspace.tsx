import CrudWorkspace from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

export default function UtilityPaymentsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "utility-payments",
        title: "Utility Payments",
        subtitle: "Bill payments, biller aggregation, electricity/water/cable/airtime (Go :8183)",
        icon: Zap,
        accentColor: "text-yellow-600",
        idField: "id",
        statusField: "status",
        searchFields: ["biller_name", "biller_category"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "Payment ID" },
          { key: "biller_name", label: "Biller", sortable: true },
          { key: "biller_category", label: "Category", sortable: true },
          { key: "customer_ref", label: "Ref", sortable: true },
          { key: "amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "channel", label: "Channel", sortable: true },
          { key: "payment_date", label: "Date", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
