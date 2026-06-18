import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { TestTube } from "lucide-react";
const config: CrudConfig = {
  domainKey: "unit-test-runner", title: "Unit Test Runner",
  subtitle: "48 suites, 1240 tests, 78.4% coverage across Go/Rust/Python/TypeScript.",
  icon: TestTube, accentColor: "teal",
  fields: [
    { key: "id", label: "ID", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["active", "inactive", "pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/anomaly-models",
};
export default function UnitTestRunnerWorkspace() { return <CrudWorkspace config={config} />; }
