import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "jwt-validator",
  title: "JWT Token Validator",
  subtitle: "Real JWKS validation and token introspection",
  icon: Shield,
  accentColor: "blue",
  apiBase: "/api/db/jwt-validations",
  idField: "id",
  statusField: "status",
  searchFields: ["tokenType"],
  fields: [
    { key: "tokenType", label: "Token Type", type: "text" },
    { key: "issuer", label: "Issuer", type: "text" },
    { key: "audience", label: "Audience", type: "text" },
    { key: "algorithm", label: "Algorithm", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "tokenType", label: "Token Type" },
    { key: "issuer", label: "Issuer" },
    { key: "audience", label: "Audience" },
    { key: "algorithm", label: "Algorithm" },
    { key: "status", label: "Status" }
  ],
};

export default function JWTValidatorWorkspace() {
  return <CrudWorkspace config={config} />;
}
