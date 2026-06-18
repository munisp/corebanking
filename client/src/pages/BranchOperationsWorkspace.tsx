import { useState, useEffect } from "react";

interface Column { key: string; label: string; }

export default function BranchOperationsWorkspace() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/db/agent-banking-agents")
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => {});
    fetch("/api/db/agent-banking-agents/count")
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  }, []);

  const columns: Column[] = [{key:"id",label:"ID"},{key:"name",label:"Branch Name"},{key:"code",label:"Code"},{key:"region",label:"Region"},{key:"state",label:"State"},{key:"manager",label:"Manager"},{key:"tellerCount",label:"Tellers"},{key:"status",label:"Status"}];

  const filtered = (() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter((item: any) =>
      Object.values(item).some((v: any) => String(v).toLowerCase().includes(q))
    );
  })();

  return (
    <div style={{ padding: "24px" }}>
      <h2 style={{ marginBottom: "16px" }}>Branch Operations</h2>
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", marginBottom: "16px" }}
      />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((col) => <th key={col.key} style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 600 }}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                {columns.map((col) => <td key={col.key} style={{ padding: "10px" }}>{String(item[col.key] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: "12px", color: "#666" }}>Showing {filtered.length} of {items.length} items</p>
    </div>
  );
}
