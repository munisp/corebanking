import { GitBranch } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "workflows-definitions",
  title: "Workflows",
  subtitle: "Workflow automation definitions",
  icon: GitBranch,
  accentColor: "violet",
  fields: [{key:"id",label:"Workflow ID",type:"text"},{key:"name",label:"Name",type:"text"},{key:"category",label:"Category",type:"select",options:["lending","operations","payments","cards","compliance"]},{key:"slaHours",label:"SLA Hours",type:"number"},{key:"status",label:"Status",type:"select",options:["active","draft","archived"]}],
  columns: [{key:"id",label:"ID"},{key:"name",label:"Name"},{key:"category",label:"Category"},{key:"steps",label:"Steps",render:(v:unknown)=>Array.isArray(v)?v.length:0},{key:"slaHours",label:"SLA (hrs)"},{key:"version",label:"Version"},{key:"status",label:"Status"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/workflow-cases",
  pageSize: 25,
};

export default function WorkflowDefinitionsWorkspace() {
  return <CrudWorkspace config={config} />;
}
