import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Key } from "lucide-react";

const config: CrudConfig = {
  domainKey: "redis-session",
  title: "Redis Session Store",
  subtitle: "Persistent Redis session store with sliding TTL",
  icon: Key,
  accentColor: "red",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["sessionId"],
  fields: [
    { key: "sessionId", label: "Session ID", type: "text" },
    { key: "userId", label: "User ID", type: "text" },
    { key: "deviceType", label: "Device", type: "text" },
    { key: "expiresIn", label: "Expires", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "sessionId", label: "Session ID" },
    { key: "userId", label: "User ID" },
    { key: "deviceType", label: "Device" },
    { key: "expiresIn", label: "Expires" },
    { key: "status", label: "Status" }
  ],
};

export default function RedisSessionStoreWorkspace() {
  return <CrudWorkspace config={config} />;
}
