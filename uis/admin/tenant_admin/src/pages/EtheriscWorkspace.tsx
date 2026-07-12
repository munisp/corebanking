import CrudWorkspace from "@/components/CrudWorkspace";
import { Leaf } from "lucide-react";

export default function EtheriscWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "etherisc",
        title: "Etherisc Insurance",
        subtitle: "Parametric crop insurance policies via Etherisc decentralised protocol",
        icon: Leaf,
        accentColor: "text-green-700",
        idField: "policy_id",
        statusField: "status",
        searchFields: ["policy_id", "farmer_id", "crop_type", "location"],
        apiBase: "/etherisc/v1/policies",
        pageSize: 25,
        columns: [
          { key: "policy_id",     label: "Policy ID" },
          { key: "farmer_id",     label: "Farmer",         sortable: true },
          { key: "crop_type",     label: "Crop",           sortable: true },
          { key: "location",      label: "Location",       sortable: true },
          { key: "insured_value", label: "Insured Value",  sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "premium",       label: "Premium",        sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "trigger_type",  label: "Trigger",        sortable: true },
          { key: "start_date",    label: "Start Date",     sortable: true },
          { key: "end_date",      label: "End Date",       sortable: true },
          { key: "status",        label: "Status",         sortable: true },
        ],
        fields: [
          { key: "farmer_id",     label: "Farmer ID",      type: "text", required: true },
          { key: "crop_type",     label: "Crop Type",      type: "text", required: true },
          { key: "location",      label: "Location",       type: "text", required: true },
          { key: "insured_value", label: "Insured Value (₦)", type: "number", required: true },
          { key: "trigger_type",  label: "Trigger Type",   type: "text" },
          { key: "start_date",    label: "Start Date",     type: "text" },
          { key: "end_date",      label: "End Date",       type: "text" },
        ],
      }}
    />
  );
}
