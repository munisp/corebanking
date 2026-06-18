import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { LayoutGrid } from "lucide-react";
const config: CrudConfig = {
  domainKey: "grid-token-cards", title: "Grid Token Cards",
  subtitle: "Grid-based challenge-response cards (Barclays PINsentry-style). 5x5/8x4/10x5 grids for transaction authorization.",
  icon: LayoutGrid, accentColor: "blue",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "gridSize", label: "Grid Size", type: "select", options: ["5x5", "8x4", "10x5"], required: true },
    { key: "branchCode", label: "Branch Code", type: "text" },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "customerName", label: "Customer", sortable: true },
    { key: "cardSerial", label: "Serial", sortable: true },
    { key: "gridSize", label: "Grid" },
    { key: "status", label: "Status", sortable: true },
    { key: "usageCount", label: "Usage" },
    { key: "branchCode", label: "Branch" },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/grid-cards",
};
export default function GridTokenCardWorkspace() { return <CrudWorkspace config={config} />; }
