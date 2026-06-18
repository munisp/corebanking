import { Heart } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "islamic-takaful",
  title: "Takaful Insurance",
  subtitle: "Islamic takaful policy management",
  icon: Heart,
  accentColor: "green",
  fields: [{key:"id",label:"Policy ID",type:"text"},{key:"policyType",label:"Type",type:"select",options:["family_takaful","general_takaful","health_takaful","motor_takaful"]},{key:"participant",label:"Participant",type:"text"},{key:"contribution",label:"Contribution",type:"number"},{key:"coverageAmount",label:"Coverage Amount",type:"number"},{key:"status",label:"Status",type:"select",options:["active","claims_pending","expired"]}],
  columns: [{key:"id",label:"ID"},{key:"policyType",label:"Type"},{key:"participant",label:"Participant"},{key:"contribution",label:"Contribution (₦)",render:(v:unknown)=>`₦${(Number(v)||0).toLocaleString()}`},{key:"coverageAmount",label:"Coverage (₦)",render:(v:unknown)=>`₦${(Number(v)||0).toLocaleString()}`},{key:"surplusShare",label:"Surplus %"},{key:"status",label:"Status"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function TakafulManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
