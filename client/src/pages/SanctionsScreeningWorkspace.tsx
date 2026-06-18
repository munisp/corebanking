import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldAlert } from "lucide-react";
const config: CrudConfig = {
  domainKey: "sanctions-screening", title: "Real-Time Sanctions Screening",
  subtitle: "OFAC SDN, UN Security Council, EU Consolidated, HMT, CBN Internal, EFCC — Levenshtein + Soundex + Jaro-Winkler fuzzy matching with transliteration.",
  icon: ShieldAlert, accentColor: "red",
  fields: [
    { key: "name", label: "Name to Screen", type: "text", required: true },
    { key: "listId", label: "Sanctions List", type: "select", options: ["OFAC", "UN", "EU", "HMT", "CBN", "EFCC", "ALL"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "name", label: "List Name", sortable: true },
    { key: "source", label: "Source" }, { key: "entryCount", label: "Entries" },
    { key: "lastUpdated", label: "Last Updated", sortable: true },
  ],
  idField: "id", statusField: "active", searchFields: ["name", "source"],
  apiBase: "/api/db/accounts",
};
export default function SanctionsScreeningWorkspace() { return <CrudWorkspace config={config} />; }
