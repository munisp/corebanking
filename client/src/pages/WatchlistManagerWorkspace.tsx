import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

const config: CrudConfig = {
  domainKey: "watchlist-manager",
  title: "Global Watchlist Manager",
  subtitle: "Real-time OFAC/UN/EU/CBN/EFCC/FATF list sync",
  icon: Globe,
  accentColor: "red",
  apiBase: "/api/db/watchlist-sources",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "List Name", type: "text" },
    { key: "source", label: "Source", type: "text" },
    { key: "entries", label: "Entries", type: "number" },
    { key: "lastSync", label: "Last Sync", type: "text" },
    { key: "syncFrequency", label: "Frequency", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "List Name" },
    { key: "source", label: "Source" },
    { key: "entries", label: "Entries" },
    { key: "lastSync", label: "Last Sync" },
    { key: "syncFrequency", label: "Frequency" },
    { key: "status", label: "Status" }
  ],
};

export default function WatchlistManagerWorkspace() {
  return <CrudWorkspace config={config} />;
}
