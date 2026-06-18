import CrudWorkspace from "@/components/CrudWorkspace";
import { QrCode } from "lucide-react";

export default function QRPaymentsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "qr-payments",
        title: "QR Payments",
        subtitle: "NIBSS QR, Mastercard QR, Visa QR, dynamic/static codes (Go :8187)",
        icon: QrCode,
        accentColor: "text-violet-700",
        idField: "id",
        statusField: "status",
        searchFields: ["merchant_name", "qr_type", "channel"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "Txn ID" },
          { key: "merchant_name", label: "Merchant", sortable: true },
          { key: "merchant_id", label: "Merchant ID" },
          { key: "amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "qr_type", label: "QR Type", sortable: true },
          { key: "channel", label: "Channel", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
