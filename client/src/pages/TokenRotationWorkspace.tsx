import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { RefreshCw } from "lucide-react";

const config: CrudConfig = {
  domainKey: "token-rotation",
  title: "Token Rotation Engine",
  subtitle: "Refresh token family rotation and replay detection",
  icon: RefreshCw,
  accentColor: "blue",
  apiBase: "/api/db/token-families",
  idField: "id",
  statusField: "status",
  searchFields: ["familyId"],
  fields: [
    { key: "familyId", label: "Family ID", type: "text" },
    { key: "userId", label: "User ID", type: "text" },
    { key: "generation", label: "Generation", type: "number" },
    { key: "replayDetected", label: "Replay Detected", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "familyId", label: "Family ID" },
    { key: "userId", label: "User ID" },
    { key: "generation", label: "Generation" },
    { key: "replayDetected", label: "Replay Detected" },
    { key: "status", label: "Status" }
  ],
};

export default function TokenRotationWorkspace() {
  return <CrudWorkspace config={config} />;
}
