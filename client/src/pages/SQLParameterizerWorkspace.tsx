import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sql-parameterizer",
  title: "SQL Parameterizer",
  subtitle: "SQL injection prevention via parameterization",
  icon: Database,
  accentColor: "red",
  apiBase: "/api/db/sql-queries",
  idField: "id",
  statusField: "status",
  searchFields: ["originalQuery"],
  fields: [
    { key: "originalQuery", label: "Query", type: "text" },
    { key: "parameterized", label: "Parameterized", type: "text" },
    { key: "injectionAttempts", label: "Injection Attempts", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "originalQuery", label: "Query" },
    { key: "parameterized", label: "Parameterized" },
    { key: "injectionAttempts", label: "Injection Attempts" },
    { key: "status", label: "Status" }
  ],
};

export default function SQLParameterizerWorkspace() {
  return <CrudWorkspace config={config} />;
}
