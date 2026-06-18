import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Cpu } from "lucide-react";

const config: CrudConfig = {
  domainKey: "billing-event-processor",
  title: "Billing Event Processor",
  subtitle: "Real-time metering, Kafka event consumption, revenue capture, overhead allocation, and analytics pipeline",
  icon: Cpu,
  accentColor: "amber",
  fields: [],
  columns: [
    { key: "id", label: "Event ID", sortable: true },
    { key: "tenant_id", label: "Tenant", sortable: true },
    { key: "source_service", label: "Source", sortable: true },
    { key: "event_type", label: "Event Type", sortable: true },
    { key: "meter_key", label: "Meter Key", sortable: true },
    { key: "quantity", label: "Quantity", sortable: true },
    { key: "unit_amount", label: "Unit Amount", sortable: true },
    { key: "processing_status", label: "Status", sortable: true },
  ],
  idField: "id",
  searchFields: ["id", "tenant_id", "source_service", "event_type", "meter_key"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function BillingEventProcessorWorkspace() {
  return <CrudWorkspace config={config} />;
}
