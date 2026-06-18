import { PlayCircle } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "workflows-instances",
  title: "Workflow Instances",
  subtitle: "Active workflow execution tracking",
  icon: PlayCircle,
  accentColor: "blue",
  fields: [{key:"id",label:"Instance ID",type:"text"},{key:"workflowId",label:"Workflow ID",type:"text"},{key:"status",label:"Status",type:"select",options:["in_progress","completed","blocked","failed"]}],
  columns: [{key:"id",label:"Instance ID"},{key:"workflowName",label:"Workflow"},{key:"currentStep",label:"Step"},{key:"status",label:"Status"},{key:"startedAt",label:"Started"},{key:"completedAt",label:"Completed"},{key:"initiator",label:"Initiator"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/workflow-cases",
  pageSize: 25,
};

export default function WorkflowInstancesWorkspace() {
  return <CrudWorkspace config={config} />;
}
