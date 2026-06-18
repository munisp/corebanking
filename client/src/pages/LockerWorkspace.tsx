import CrudWorkspace from "@/components/CrudWorkspace";
import { FolderLock } from "lucide-react";

export default function LockerWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "locker",
        title: "Digital Locker",
        subtitle: "Secure document storage, share certificates, title deeds (Go :8196)",
        icon: FolderLock,
        accentColor: "text-purple-800",
        idField: "id",
        statusField: "status",
        searchFields: ["customer_name", "item_type"],
        apiBase: "/api/db/vault-secrets",
        pageSize: 25,
        columns: [
          { key: "id", label: "Item ID" },
          { key: "customer_name", label: "Customer", sortable: true },
          { key: "item_type", label: "Type", sortable: true },
          { key: "description", label: "Description" },
          { key: "stored_date", label: "Stored", sortable: true },
          { key: "expiry_date", label: "Expiry" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
