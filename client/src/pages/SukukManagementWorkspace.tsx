import { Shield } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "islamic-sukuk",
  title: "Sukuk Management",
  subtitle: "Islamic sukuk bond management",
  icon: Shield,
  accentColor: "purple",
  fields: [{key:"id",label:"Sukuk ID",type:"text"},{key:"sukukType",label:"Type",type:"select",options:["ijara","mudarabah","wakala","musharakah"]},{key:"issuer",label:"Issuer",type:"text"},{key:"faceValue",label:"Face Value",type:"number"},{key:"couponRate",label:"Coupon Rate %",type:"number"},{key:"maturityDate",label:"Maturity Date",type:"date"},{key:"status",label:"Status",type:"select",options:["active","matured","redeemed"]}],
  columns: [{key:"id",label:"ID"},{key:"sukukType",label:"Type"},{key:"issuer",label:"Issuer"},{key:"faceValue",label:"Face Value (₦)",render:(v:unknown)=>`₦${(Number(v)||0).toLocaleString()}`},{key:"couponRate",label:"Coupon %"},{key:"maturityDate",label:"Maturity"},{key:"status",label:"Status"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function SukukManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
