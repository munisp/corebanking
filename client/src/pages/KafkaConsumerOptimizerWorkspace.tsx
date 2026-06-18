import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

const config: CrudConfig = {
  domainKey: "kafka-consumer",
  title: "Kafka Consumer Optimizer",
  subtitle: "Consumer group health and lag monitoring",
  icon: Activity,
  accentColor: "blue",
  apiBase: "/api/db/kafka-consumer-groups",
  idField: "id",
  statusField: "status",
  searchFields: ["groupId"],
  fields: [
    { key: "groupId", label: "Group ID", type: "text" },
    { key: "topic", label: "Topic", type: "text" },
    { key: "partitions", label: "Partitions", type: "number" },
    { key: "lag", label: "Lag", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "groupId", label: "Group ID" },
    { key: "topic", label: "Topic" },
    { key: "partitions", label: "Partitions" },
    { key: "lag", label: "Lag" },
    { key: "status", label: "Status" }
  ],
};

export default function KafkaConsumerOptimizerWorkspace() {
  return <CrudWorkspace config={config} />;
}
