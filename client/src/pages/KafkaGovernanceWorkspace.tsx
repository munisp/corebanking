import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Radio } from "lucide-react";
const config: CrudConfig = {
  domainKey: "kafka-governance", title: "Kafka Schema Registry & Governance",
  subtitle: "AVRO/Protobuf schema registry with backward/full compatibility, 247 topics, 89 schemas, dead-letter queues, retention policies.",
  icon: Radio, accentColor: "sky",
  fields: [
    { key: "subject", label: "Subject", type: "text", required: true },
    { key: "type", label: "Type", type: "select", options: ["AVRO", "PROTOBUF", "JSON"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "subject", label: "Subject", sortable: true },
    { key: "version", label: "Version" }, { key: "type", label: "Type" },
    { key: "fields", label: "Fields" },
  ],
  idField: "id", searchFields: ["subject", "type"],
  apiBase: "/api/db/avro-schemas",
};
export default function KafkaGovernanceWorkspace() { return <CrudWorkspace config={config} />; }
