import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Key } from "lucide-react";

const config: CrudConfig = {
  domainKey: "pin-hasher",
  title: "PIN Hasher (Argon2)",
  subtitle: "Argon2id PIN hashing with configurable params",
  icon: Key,
  accentColor: "orange",
  apiBase: "/api/db/pin-hashes",
  idField: "id",
  statusField: "status",
  searchFields: ["algorithm"],
  fields: [
    { key: "algorithm", label: "Algorithm", type: "text" },
    { key: "memoryCost", label: "Memory Cost", type: "number" },
    { key: "timeCost", label: "Time Cost", type: "number" },
    { key: "activeHashes", label: "Active Hashes", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "algorithm", label: "Algorithm" },
    { key: "memoryCost", label: "Memory Cost" },
    { key: "timeCost", label: "Time Cost" },
    { key: "activeHashes", label: "Active Hashes" },
    { key: "status", label: "Status" }
  ],
};

export default function PINHasherWorkspace() {
  return <CrudWorkspace config={config} />;
}
