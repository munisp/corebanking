import { useEffect, useState } from "react";
import apiClient from "../services/api";

function getTenantId(): string {
  return (
    (import.meta.env.VITE_TENANT_ID as string | undefined) ||
    localStorage.getItem("tenant_id") ||
    ""
  );
}

export function useDashboardData() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{ total_count: number; total_volume: number }>({ total_count: 0, total_volume: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const tenantId = getTenantId();
      try {
        // Fetch metrics
        const metricsResponse = await apiClient.get("/ledger/txn/metrics", { params: { tenant_id: tenantId } });
        const metricsData = metricsResponse.data;
        if (metricsData?.metrics) {
          setMetrics(metricsData.metrics);
        }

        // Fetch transactions
        const txnResponse = await apiClient.get("/ledger/txn/", { params: { tenant_id: tenantId } });
        const txnData = txnResponse.data;
        const txns = Array.isArray(txnData.transactions)
          ? txnData.transactions
          : [];
        setTransactions(txns);

        // Fetch users
        try {
          const userResponse = await apiClient.get("/user/user/tenant", { params: { tenant_id: tenantId } });
          const userData = userResponse.data;
          const usersData = Array.isArray(userData)
            ? userData
            : Array.isArray(userData.users)
              ? userData.users
              : Array.isArray(userData.data)
                ? userData.data
                : [];
          setUsers(usersData);
        } catch (error) {
          console.error("Error fetching users:", error);
          setUsers([]);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    transactions,
    users,
    metrics,
    loading,
  };
}
