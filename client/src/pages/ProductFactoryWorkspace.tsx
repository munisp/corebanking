import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Factory } from "lucide-react";

const config: CrudConfig = {
  domainKey: "product-factory",
  title: "Product Factory",
  subtitle: "Configuration-driven banking product definitions with parameters, GL mappings, fee rules",
  icon: Factory,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Product ID", sortable: true },
    { key: "code", label: "Code", sortable: true },
    { key: "name", label: "Product Name", sortable: true },
    { key: "category", label: "Category", sortable: true },
    { key: "productType", label: "Type", sortable: true },
    { key: "currency", label: "Currency", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id",
  searchFields: ["id", "code", "name", "category"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function ProductFactoryWorkspace() {
  return <CrudWorkspace config={config} />;
}
