import { Activity } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "infra-kafka",
  title: "Kafka Event Broker",
  subtitle: "Production event streaming — topics, consumer groups, dead-letter queue, schema registry",
  icon: Activity,
  accentColor: "orange",
  fields: [
    { key: "name", label: "Topic Name", type: "readonly" },
    { key: "partitions", label: "Partitions", type: "readonly" },
    { key: "replicationFactor", label: "Replication", type: "readonly" },
    { key: "messageCount", label: "Messages", type: "readonly" },
    { key: "cleanupPolicy", label: "Cleanup", type: "readonly" },
  ],
  columns: [
    { key: "name", label: "Topic" },
    { key: "partitions", label: "Partitions" },
    { key: "replicationFactor", label: "Replicas" },
    { key: "messageCount", label: "Messages" },
    { key: "cleanupPolicy", label: "Policy" },
  ],
  idField: "name",
  searchFields: ["name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function InfraKafkaWorkspace() {
  return <CrudWorkspace config={config} />;
}
