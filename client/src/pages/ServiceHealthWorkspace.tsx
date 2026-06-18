import { Activity } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "health-registry",
  title: "Service Health",
  subtitle: "Platform service health monitoring",
  icon: Activity,
  accentColor: "green",
  fields: [{key:"name",label:"Service Name",type:"readonly"},{key:"port",label:"Port",type:"readonly"},{key:"language",label:"Language",type:"readonly"}],
  columns: [{key:"name",label:"Service"},{key:"port",label:"Port"},{key:"language",label:"Language"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function ServiceHealthWorkspace() {
  return <CrudWorkspace config={config} />;
}
