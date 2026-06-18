import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Radio } from "lucide-react";

const config: CrudConfig = {
  domainKey: "event-streaming",
  title: "Event Streaming",
  subtitle: "Real-time Kafka event streaming with topics, consumer groups, dead-letter queues, and schema registry",
  icon: Radio,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "name", label: "Topic Name", sortable: true },
    { key: "partitions", label: "Partitions", sortable: true },
    { key: "replicationFactor", label: "Replication", sortable: true },
    { key: "messageCount", label: "Messages", sortable: true },
    { key: "consumerLag", label: "Consumer Lag", sortable: true },
    { key: "schemaFormat", label: "Schema", sortable: false },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "name",
  searchFields: ["name", "partitions", "replicationFactor", "messageCount"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function EventStreamingWorkspace() {
  return <CrudWorkspace config={config} />;
}
