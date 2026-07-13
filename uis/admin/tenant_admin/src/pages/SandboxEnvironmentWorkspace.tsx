import CrudWorkspace from "@/components/CrudWorkspace";
import { Server } from "lucide-react";

export default function SandboxEnvironmentWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "sandbox_environments",
        title: "Sandbox Environment",
        subtitle: "Manage sandbox environments for developer testing",
        icon: Server,
        accentColor: "text-teal-700",
        idField: "env_id",
        statusField: "status",
        searchFields: ["env_id", "name", "owner_id"],
        apiBase: "/developer/v1/sandbox/environments",
        pageSize: 25,
        columns: [
          { key: "env_id",     label: "Env ID",      type: "text" },
          { key: "name",       label: "Name",         type: "text" },
          { key: "owner_id",   label: "Owner",        type: "text" },
          { key: "region",     label: "Region",       type: "text" },
          { key: "api_url",    label: "API URL",      type: "text" },
          { key: "created_at", label: "Created",      type: "date" },
          { key: "expires_at", label: "Expires",      type: "date" },
          { key: "status",     label: "Status",       type: "badge" },
        ],
        fields: [
          { key: "name",   label: "Environment Name", type: "text",   required: true },
          { key: "region", label: "Region",            type: "text",   required: true, placeholder: "ng-west" },
        ],
      }}
    />
  );
}
