import { Users } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "agents-performance",
  title: "Agent Performance",
  subtitle: "Agent banking performance and scoring",
  icon: Users,
  accentColor: "orange",
  fields: [{key:"agentId",label:"Agent ID",type:"text"},{key:"name",label:"Name",type:"text"},{key:"tier",label:"Tier",type:"select",options:["agent","super_agent","master_agent"]},{key:"score",label:"Score",type:"number"}],
  columns: [{key:"agentId",label:"Agent ID"},{key:"name",label:"Name"},{key:"tier",label:"Tier"},{key:"location",label:"State",render:(_:unknown,row:Record<string,unknown>)=>{const loc=row.location as Record<string,unknown>;return String(loc?.state||"")}},{key:"monthlyTxnVolume",label:"Monthly Txns",render:(v:unknown)=>Number(v).toLocaleString()},{key:"commissionEarned",label:"Commission (₦)",render:(v:unknown)=>`₦${(Number(v)||0).toLocaleString()}`},{key:"score",label:"Score"},{key:"uptimePercent",label:"Uptime %"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function AgentPerformanceWorkspace() {
  return <CrudWorkspace config={config} />;
}
