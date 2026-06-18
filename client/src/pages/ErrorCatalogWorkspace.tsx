import CrudWorkspace from "@/components/CrudWorkspace";
import { AlertCircle } from "lucide-react";

export default function ErrorCatalogWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "errorcatalog",
        title: "Error Catalog",
        subtitle: "Structured error codes with domain prefixes, retry classification, remediation guides",
        icon: AlertCircle,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "severity",
        searchFields: ["code", "domain", "message"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "code", label: "Code", sortable: true },
          { key: "domain", label: "Domain", sortable: true },
          { key: "message", label: "Message" },
          { key: "severity", label: "Severity", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "httpStatus", label: "HTTP" },
          { key: "retryable", label: "Retryable" },
        ],
        fields: [],
      }}
    />
  );
}
