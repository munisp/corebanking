import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Link2 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "immutable-audit",
  title: "Immutable Audit Chain",
  subtitle: "Blockchain-anchored immutable audit trail",
  icon: Link2,
  accentColor: "purple",
  apiBase: "/api/db/immutable-audit",
  idField: "id",
  statusField: "status",
  searchFields: ["blockNumber"],
  fields: [
    { key: "blockNumber", label: "Block #", type: "number" },
    { key: "transactions", label: "Transactions", type: "number" },
    { key: "verified", label: "Verified", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "blockNumber", label: "Block #" },
    { key: "transactions", label: "Transactions" },
    { key: "verified", label: "Verified" },
    { key: "status", label: "Status" }
  ],
};

export default function ImmutableAuditWorkspace() {
  return <CrudWorkspace config={config} />;
}
