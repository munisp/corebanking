import { ShieldAlert } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "cards-fraud-rules",
  title: "Card Fraud Rules",
  subtitle: "Card fraud detection rules engine",
  icon: ShieldAlert,
  accentColor: "red",
  fields: [{key:"id",label:"Rule ID",type:"text"},{key:"name",label:"Rule Name",type:"text"},{key:"ruleType",label:"Type",type:"select",options:["velocity","geolocation","amount","merchant_category","time_based"]},{key:"threshold",label:"Threshold",type:"number"},{key:"action",label:"Action",type:"select",options:["decline","require_otp","sms_alert","flag_for_review","block_and_alert"]},{key:"enabled",label:"Enabled",type:"select",options:["true","false"]}],
  columns: [{key:"id",label:"Rule ID"},{key:"name",label:"Rule Name"},{key:"ruleType",label:"Type"},{key:"threshold",label:"Threshold"},{key:"action",label:"Action"},{key:"enabled",label:"Enabled",render:(v:unknown)=>v?"Yes":"No"},{key:"triggeredCount",label:"Triggered"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function CardFraudRulesWorkspace() {
  return <CrudWorkspace config={config} />;
}
