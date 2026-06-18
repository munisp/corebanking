import CrudWorkspace from "@/components/CrudWorkspace";
import { Signal } from "lucide-react";

export default function BandwidthAdaptationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "bandwidth-adaptation",
        title: "Bandwidth Adaptation",
        subtitle: "Adaptive profiles for 4G to offline, compression, protobuf/cbor encoding",
        icon: Signal,
        accentColor: "text-teal-700",
        idField: "id",
        statusField: "connectionType",
        searchFields: ["connectionType", "strategy"],
        apiBase: "/api/db/compression-configs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "connectionType", label: "Connection", sortable: true },
          { key: "estimatedKbps", label: "Kbps", sortable: true },
          { key: "strategy", label: "Strategy", sortable: true },
          { key: "compressionLevel", label: "Compression", sortable: true },
          { key: "payloadFormat", label: "Format", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
