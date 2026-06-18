import { Database } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "infra-postgres",
  title: "PostgreSQL Persistence",
  subtitle: "Production database — connection pooling, JSONB records, audit trail, generic CRUD for all banking domains",
  icon: Database,
  accentColor: "blue",
  fields: [
    { key: "id", label: "Record ID", type: "readonly" },
    { key: "customerName", label: "Customer Name", type: "readonly" },
    { key: "accountNumber", label: "Account Number", type: "readonly" },
    { key: "type", label: "Type", type: "readonly" },
    { key: "balance", label: "Balance", type: "readonly" },
    { key: "currency", label: "Currency", type: "readonly" },
    { key: "status", label: "Status", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "customerName", label: "Customer" },
    { key: "accountNumber", label: "Account" },
    { key: "type", label: "Type" },
    { key: "balance", label: "Balance" },
    { key: "status", label: "Status" },
  ],
  idField: "id",
  searchFields: ["id", "customerName", "accountNumber"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function InfraPostgresWorkspace() {
  return <CrudWorkspace config={config} />;
}
