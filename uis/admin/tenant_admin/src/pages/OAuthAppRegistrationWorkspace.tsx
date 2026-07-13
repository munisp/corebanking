import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function OAuthAppRegistrationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "oauth_apps",
        title: "OAuth App Registration",
        subtitle: "Register and manage OAuth 2.0 applications",
        icon: Shield,
        accentColor: "text-indigo-700",
        idField: "client_id",
        statusField: "status",
        searchFields: ["client_id", "app_name", "owner_id"],
        apiBase: "/developer/v1/oauth/apps",
        pageSize: 25,
        columns: [
          { key: "client_id",    label: "Client ID",     type: "text" },
          { key: "app_name",     label: "App Name",      type: "text" },
          { key: "redirect_uri", label: "Redirect URI",  type: "text" },
          { key: "grant_types",  label: "Grant Types",   type: "text" },
          { key: "scopes",       label: "Scopes",        type: "text" },
          { key: "owner_id",     label: "Owner",         type: "text" },
          { key: "created_at",   label: "Registered",    type: "date" },
          { key: "status",       label: "Status",        type: "badge" },
        ],
        fields: [
          { key: "app_name",     label: "App Name",      type: "text",   required: true },
          { key: "redirect_uri", label: "Redirect URI",  type: "text",   required: true },
          { key: "grant_types",  label: "Grant Types",   type: "text",   required: true, placeholder: "authorization_code refresh_token" },
          { key: "scopes",       label: "Scopes",        type: "text",   required: true },
        ],
      }}
    />
  );
}
