import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { TestTube2 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "integration-tests",
  title: "Integration Tests",
  subtitle: "Automated test harness for all microservices",
  icon: TestTube2,
  accentColor: "green",
  idField: "name",
  searchFields: ["name", "service", "method", "endpoint"],
  apiBase: "/api/db/accounts",
  columns: [
    { key: "name", label: "Test Name", sortable: true },
    { key: "service", label: "Service", sortable: true },
    { key: "method", label: "Method", sortable: true },
    { key: "endpoint", label: "Endpoint", sortable: true },
    { key: "expectedStatus", label: "Expected", sortable: true },
  ],
  fields: [
    { key: "name", label: "Test Name", type: "text", required: true },
    { key: "service", label: "Service", type: "text", required: true },
    { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "DELETE"] },
    { key: "endpoint", label: "Endpoint", type: "text", required: true },
    { key: "expectedStatus", label: "Expected Status", type: "number" },
  ],
};

export default function IntegrationTestsWorkspace() {
  return <CrudWorkspace config={config} />;
}
