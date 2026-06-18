import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Box } from "lucide-react";

const config: CrudConfig = {
  domainKey: "docker-hardener",
  title: "Docker Hardener",
  subtitle: "CIS Docker Benchmark compliance scanner",
  icon: Box,
  accentColor: "gray",
  apiBase: "/api/db/docker-hardening",
  idField: "id",
  statusField: "status",
  searchFields: ["check"],
  fields: [
    { key: "check", label: "Check", type: "text" },
    { key: "cisBenchmark", label: "CIS Benchmark", type: "text" },
    { key: "severity", label: "Severity", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "check", label: "Check" },
    { key: "cisBenchmark", label: "CIS Benchmark" },
    { key: "severity", label: "Severity" },
    { key: "status", label: "Status" }
  ],
};

export default function DockerHardenerWorkspace() {
  return <CrudWorkspace config={config} />;
}
