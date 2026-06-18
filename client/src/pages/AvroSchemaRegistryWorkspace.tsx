import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "avro-schema",
  title: "Avro Schema Registry",
  subtitle: "Schema-first Avro encoding for Kafka",
  icon: FileCheck,
  accentColor: "purple",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["subject"],
  fields: [
    { key: "subject", label: "Subject", type: "text" },
    { key: "version", label: "Version", type: "number" },
    { key: "compatibilityMode", label: "Compat", type: "text" },
    { key: "compressionRatio", label: "Compression", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "subject", label: "Subject" },
    { key: "version", label: "Version" },
    { key: "compatibilityMode", label: "Compat" },
    { key: "compressionRatio", label: "Compression" },
    { key: "status", label: "Status" }
  ],
};

export default function AvroSchemaRegistryWorkspace() {
  return <CrudWorkspace config={config} />;
}
