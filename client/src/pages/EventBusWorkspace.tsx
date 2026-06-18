import { Radio } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "event-bus",
  title: "Event Bus",
  subtitle: "Kafka-compatible event streaming — topics, publish, consumers, subscriptions",
  icon: Radio,
  accentColor: "bg-orange-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "name", "retention"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "name", label: "Topic Name", type: "text", required: true, placeholder: "e.g. customer.created" },
    { key: "partitions", label: "Partitions", type: "number", defaultValue: 3 },
    { key: "replication", label: "Replication Factor", type: "number", defaultValue: 1 },
    { key: "retention", label: "Retention", type: "select", options: ["1d", "3d", "7d", "14d", "30d", "90d", "forever"], defaultValue: "7d" },
    { key: "schema", label: "Avro Schema (optional)", type: "text" },
  ],
  columns: [
    { key: "id", label: "Topic ID" },
    { key: "name", label: "Topic Name" },
    { key: "partitions", label: "Partitions" },
    { key: "replication", label: "Replicas" },
    { key: "retention", label: "Retention" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Pause", key: "pause", condition: (r) => r.status === "active" },
    { label: "Resume", key: "resume", condition: (r) => r.status === "paused" },
  ],
};

export default function EventBusWorkspace() {
  return <CrudWorkspace config={config} />;
}
