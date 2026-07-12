import CrudWorkspace from "@/components/CrudWorkspace";
import { KeyRound } from "lucide-react";

export default function ApiKeyManagementWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "api_keys",
        title: "API Key Management",
        subtitle: "Manage tenant API keys for programmatic access",
        icon: KeyRound,
        accentColor: "text-blue-700",
        idField: "key_id",
        statusField: "status",
        searchFields: ["key_id", "name", "prefix", "created_by"],
        apiBase: "/developer/v1/api-keys",
        pageSize: 25,
        columns: [
          { key: "key_id",     label: "Key ID",      type: "text" },
          { key: "name",       label: "Name",         type: "text" },
          { key: "prefix",     label: "Prefix",       type: "text" },
          { key: "scopes",     label: "Scopes",       type: "text" },
          { key: "created_by", label: "Created By",   type: "text" },
          { key: "last_used",  label: "Last Used",    type: "date" },
          { key: "expires_at", label: "Expires",      type: "date" },
          { key: "status",     label: "Status",       type: "badge" },
        ],
        fields: [
          { key: "name",   label: "Key Name",   type: "text",   required: true },
          { key: "scopes", label: "Scopes",     type: "text",   required: true, placeholder: "read:accounts write:payments" },
        ],
      }}
    />
  );
}
