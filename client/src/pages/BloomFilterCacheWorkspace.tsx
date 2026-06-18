import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

const config: CrudConfig = {
  domainKey: "bloom-filter",
  title: "Bloom Filter Cache",
  subtitle: "Probabilistic negative cache with zero false negatives",
  icon: Database,
  accentColor: "purple",
  apiBase: "/api/db/bloom-filters",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "capacity", label: "Capacity", type: "number" },
    { key: "falsePositiveRate", label: "FP Rate", type: "text" },
    { key: "memoryMB", label: "Memory MB", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "capacity", label: "Capacity" },
    { key: "falsePositiveRate", label: "FP Rate" },
    { key: "memoryMB", label: "Memory MB" },
    { key: "status", label: "Status" }
  ],
};

export default function BloomFilterCacheWorkspace() {
  return <CrudWorkspace config={config} />;
}
