import { Shield } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "kyc-pep-database",
  title: "PEP Database",
  subtitle: "Politically exposed persons database",
  icon: Shield,
  accentColor: "amber",
  fields: [{key:"id",label:"PEP ID",type:"text"},{key:"name",label:"Name",type:"text"},{key:"position",label:"Position",type:"text"},{key:"category",label:"Category",type:"select",options:["domestic_pep","foreign_pep","international_org"]},{key:"riskTier",label:"Risk Tier",type:"select",options:["tier1","tier2","tier3"]}],
  columns: [{key:"id",label:"ID"},{key:"name",label:"Name"},{key:"position",label:"Position"},{key:"category",label:"Category"},{key:"jurisdiction",label:"Jurisdiction"},{key:"riskTier",label:"Risk Tier"},{key:"startDate",label:"Start Date"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function PEPDatabaseWorkspace() {
  return <CrudWorkspace config={config} />;
}
