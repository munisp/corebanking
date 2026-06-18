import { useState, useEffect } from "react";

interface Column { key: string; label: string; }

export default function DisasterRecoveryWorkspace() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/db/read-replica-configs")
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => {});
    fetch("/api/db/read-replica-configs/count")
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  }, []);

  const columns: Column[] = [{key:"id",label:"Node"},{key:"region",label:"Region"},{key:"role",label:"Role"},{key:"lagSeconds",label:"Lag (sec)"},{key:"status",label:"Status"},{key:"lastChecked",label:"Last Check"}];

  const filtered = (() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter((item: any) =>
      Object.values(item).some((v: any) => String(v).toLowerCase().includes(q))
    );
  })();

  return (
    <div style={{padding:"1.5rem"}}>
      <h1 style={{fontSize:"1.5rem",fontWeight:700,marginBottom:"1rem"}}>Disaster Recovery</h1>
      {stats && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"0.75rem",marginBottom:"1.5rem"}}>
          {Object.entries(stats).map(([k, v]: [string, any]) => (
            <div key={k} style={{background:"#f8fafc",padding:"0.75rem",borderRadius:"0.5rem",border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:"0.75rem",color:"#64748b",textTransform:"uppercase"}}>{k.replace(/([A-Z])/g, " $1").trim()}</div>
              <div style={{fontSize:"1.25rem",fontWeight:600}}>{typeof v === "number" ? v.toLocaleString() : String(v)}</div>
            </div>
          ))}
        </div>
      )}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{width:"100%",maxWidth:"400px",padding:"0.5rem 0.75rem",border:"1px solid #d1d5db",borderRadius:"0.375rem",marginBottom:"1rem"}} />
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.875rem"}}>
          <thead>
            <tr style={{borderBottom:"2px solid #e2e8f0",textAlign:"left"}}>
              {columns.map(c => <th key={c.key} style={{padding:"0.5rem 0.75rem",fontWeight:600}}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item: any, i: number) => (
              <tr key={i} style={{borderBottom:"1px solid #f1f5f9"}}>
                {columns.map(c => <td key={c.key} style={{padding:"0.5rem 0.75rem"}}>{typeof item[c.key] === "object" ? JSON.stringify(item[c.key]) : String(item[c.key] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <div style={{textAlign:"center",padding:"2rem",color:"#94a3b8"}}>No data available</div>}
    </div>
  );
}
