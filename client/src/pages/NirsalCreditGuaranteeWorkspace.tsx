import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "nirsal-credit-guarantee",
  title: "NIRSAL Credit Guarantee",
  subtitle: "CRG application, 75% guarantee tracking and claim filing",
  icon: Shield,
  accentColor: "blue",
  apiBase: "/api/db/nirsal-credit-guarantee",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "applicationRef", label: "Ref", type: "text" },
    { key: "farmerName", label: "Farmer", type: "text" },
    { key: "loanAmount", label: "Loan", type: "number" },
    { key: "guaranteePercent", label: "Guarantee %", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "applicationRef", label: "Ref" },
    { key: "farmerName", label: "Farmer" },
    { key: "loanAmount", label: "Loan Amount" },
    { key: "guaranteePercent", label: "Guarantee %" },
    { key: "commodityChain", label: "Commodity" },
    { key: "status", label: "Status" }
  ],
};

export default function NirsalCreditGuaranteeWorkspace() {
  return <CrudWorkspace config={config} />;
}
