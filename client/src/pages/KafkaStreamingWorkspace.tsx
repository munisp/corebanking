import { Activity } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "kafka-streaming",
  title: "Kafka Event Streaming",
  subtitle: "Real-time event bus — 48 topics, 7 domains, Avro schemas, DLQ management",
  icon: Activity,
  accentColor: "rose",
  fields: [
    { key: "name", label: "Topic Name", type: "readonly" },
    { key: "domain", label: "Domain", type: "readonly" },
    { key: "partitions", label: "Partitions", type: "readonly" },
  ],
  columns: [
    { key: "name", label: "Topic Name" },
    { key: "domain", label: "Domain" },
    { key: "partitions", label: "Partitions" },
    { key: "activeConsumers", label: "Consumers" },
    { key: "messagesPerSecond", label: "Msg/sec" },
    { key: "totalMessages", label: "Total Msgs" },
    { key: "schemaType", label: "Schema" },
  ],
  idField: "name",
  searchFields: ["name", "domain"],
  apiBase: "/api/db/accounts",
};

export default function KafkaStreamingWorkspace() {
  return <CrudWorkspace config={config} />;
}
