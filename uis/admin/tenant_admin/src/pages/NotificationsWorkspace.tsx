import { useEffect, useState } from "react";
import { BACKEND_URL } from "../const";

interface ApiNotification {
  id: string;
  type: string;
  subject: string | null;
  message: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  sent: number;
  pending: number;
  failed: number;
}

function getTenantId(): string {
  try {
    const config = JSON.parse(localStorage.getItem("tenant_config") || "{}");
    return config?.tenant?.tenant_id || config?.tenant_id || "";
  } catch {
    return "";
  }
}

function getUserId(): string {
  try {
    const user = JSON.parse(localStorage.getItem("auth_user") || "{}");
    // Try multiple fallbacks: id > keycloak_id (in user) > keycloak_id (from localStorage) > email
    return user?.id || user?.keycloak_id || localStorage.getItem("keycloak_id") || user?.email || "";
  } catch {
    // Fallback to keycloak_id from localStorage
    return localStorage.getItem("keycloak_id") || "";
  }
}


async function fetchFromApi(path: string, tenantId: string): Promise<Response> {
  const token = localStorage.getItem("auth_token");
  return fetch(`${BACKEND_URL}${path}/`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-tenant-id": tenantId,
      "Content-Type": "application/json",
    },
  });
}

export default function NotificationsWorkspace() {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = getUserId();
    const tenantId = getTenantId();
    if (!userId || !tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchFromApi(`/notification/api/v1/notifications/${userId}?tenant_id=${tenantId}&limit=100`, tenantId)
      .then(r => r.json())
      .then((data: { notifications: ApiNotification[] }) => {
        const notifications = data.notifications || [];
        setItems(notifications);
        const sent = notifications.filter(n => n.status === "sent").length;
        const pending = notifications.filter(n => n.status === "pending").length;
        const failed = notifications.filter(n => n.status === "failed").length;
        setStats({ total: notifications.length, sent, pending, failed });
      })
      .catch(() => setError("Failed to load notifications"))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: "id", label: "ID" },
    { key: "type", label: "Channel" },
    { key: "subject", label: "Subject" },
    { key: "message", label: "Message" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created At" },
  ];

  const filtered = (() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(item =>
      Object.values(item).some(v => String(v ?? "").toLowerCase().includes(q))
    );
  })();

  const statusColor = (status: string) => {
    if (status === "sent") return "#16a34a";
    if (status === "failed") return "#dc2626";
    return "#d97706";
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Notifications</h1>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "capitalize" }}>{k}</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search notifications..."
        style={{ width: "100%", maxWidth: "400px", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", marginBottom: "1rem" }}
      />

      {loading && <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>Loading...</div>}
      {error && <div style={{ textAlign: "center", padding: "2rem", color: "#dc2626" }}>{error}</div>}

      {!loading && !error && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                {columns.map(c => (
                  <th key={c.key} style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {columns.map(c => (
                    <td key={c.key} style={{ padding: "0.5rem 0.75rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.key === "status" ? (
                        <span style={{ color: statusColor(item.status), fontWeight: 500 }}>{item.status}</span>
                      ) : c.key === "created_at" ? (
                        item.created_at ? new Date(item.created_at).toLocaleString() : "-"
                      ) : (
                        String((item as unknown as Record<string, unknown>)[c.key] ?? "-")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>No notifications found</div>
          )}
        </div>
      )}
    </div>
  );
}
