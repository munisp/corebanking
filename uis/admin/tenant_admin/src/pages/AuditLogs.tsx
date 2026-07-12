import PageHeader from "@/components/PageHeader";
import { BACKEND_URL } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { exportToExcel } from "@/lib/exportUtils";
import { tenantService } from "@/services/tenant";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Activity,
  Calendar,
  Download,
  FileText,
  Loader2,
  Search,
  Shield,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 25;

interface AuditLog {
  id: string;
  actor_id: string;
  event_type: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  timestamp: string;
  event_data: {
    type?: string;
    email?: string;
    payee?: string;
    payer?: string;
    amount?: string;
    transaction_id?: string;
    [key: string]: any;
  };
  tenant_id: string;
}

export default function AuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { primaryColor } = useTenantBranding();

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNextPage = totalCount > 0
    ? currentPage < totalPages
    : auditLogs.length === PAGE_SIZE;
  const hasPrevPage = currentPage > 1;

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const tenantConfig = tenantService.getTenantConfig();
        const tenantId = tenantConfig?.tenant_id;

        if (!tenantId) {
          throw new Error("Tenant ID not found");
        }

        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(PAGE_SIZE),
        });

        const response = await fetch(
          `${BACKEND_URL}/audit/audits/tenant/${tenantId}?${params}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
        }

        const result = await response.json();
        // Handle both old (plain array) and new (paginated object) response shapes
        if (Array.isArray(result)) {
          setAuditLogs(result);
          setTotalCount(result.length);
        } else {
          setAuditLogs(result.data || []);
          setTotalCount(result.total ?? result.data?.length ?? 0);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch audit logs",
        );
        console.error("Error fetching audit logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [currentPage]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        log.actor_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.event_data.email &&
          log.event_data.email
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (log.event_data.transaction_id &&
          log.event_data.transaction_id
            .toLowerCase()
            .includes(searchTerm.toLowerCase()));

      const matchesAction =
        filterAction === "all" || log.event_type === filterAction;

      const matchesDateRange =
        (!dateRange.start ||
          new Date(log.timestamp) >= new Date(dateRange.start)) &&
        (!dateRange.end ||
          new Date(log.timestamp) <= new Date(dateRange.end + "T23:59:59"));

      return matchesSearch && matchesAction && matchesDateRange;
    });
  }, [auditLogs, searchTerm, filterAction, dateRange]);

  const getEventTypeBadge = (eventType: string) => {
    const eventColors: Record<string, string> = {
      LOGIN: "bg-purple-600",
      LOGOUT: "bg-gray-600",
      TRANSFER: "bg-blue-600",
      CREATE: "bg-green-600",
      UPDATE: "bg-yellow-600",
      DELETE: "bg-red-600",
      WITHDRAWAL: "bg-orange-600",
      DEPOSIT: "bg-emerald-600",
    };
    const color = eventColors[eventType.toUpperCase()] || "bg-gray-600";
    return <Badge className={`${color} hover:opacity-90`}>{eventType}</Badge>;
  };

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const stats = {
    total: totalCount,
    today: auditLogs.filter((log) => {
      const today = new Date();
      const logDate = new Date(log.timestamp);
      return logDate.toDateString() === today.toDateString();
    }).length,
    loginEvents: auditLogs.filter((log) => log.event_type === "LOGIN").length,
    uniqueUsers: new Set(auditLogs.map((log) => log.actor_id)).size,
  };

  const uniqueEventTypes = useMemo(() => {
    return Array.from(new Set(auditLogs.map((log) => log.event_type))).sort();
  }, [auditLogs]);

  const handleExportExcel = () => {
    const data = filteredLogs.map((log) => ({
      Timestamp: new Date(log.timestamp).toLocaleString(),
      "Actor ID": log.actor_id,
      "Event Type": log.event_type,
      Email: log.event_data.email || "N/A",
      "Transaction ID": log.event_data.transaction_id || "N/A",
      Amount: log.event_data.amount || "N/A",
      "Tenant ID": log.tenant_id,
    }));
    exportToExcel(data, "audit-logs");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Audit Management"
          title="Audit Logs"
          description="View and monitor all system activities and user actions"
          icon={<Shield className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={handleExportExcel}
            variant="outline"
            disabled={filteredLogs.length === 0 || loading}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-red-800 dark:text-red-200 font-medium">
              Error loading audit logs
            </p>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
              {error}
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Total Logs
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    stats.total
                  )}
                </p>
              </div>
              <FileText className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Today
                </p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    stats.today
                  )}
                </p>
              </div>
              <Calendar className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Login Events
                </p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    stats.loginEvents
                  )}
                </p>
              </div>
              <Activity className="w-12 h-12 text-purple-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Unique Users
                </p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    stats.uniqueUsers
                  )}
                </p>
              </div>
              <Shield className="w-12 h-12 text-orange-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={filterAction} onValueChange={handleFilterChange(setFilterAction)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                {uniqueEventTypes.map((eventType) => (
                  <SelectItem key={eventType} value={eventType}>
                    {eventType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Start Date
              </label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange({ ...dateRange, start: e.target.value });
                  setCurrentPage(1);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                End Date
              </label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange({ ...dateRange, end: e.target.value });
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {totalCount} logs
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden" id="audit-table">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Event Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-12 h-12 text-muted-foreground mb-4 animate-spin" />
                        <p className="text-muted-foreground font-medium">
                          Loading audit logs...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground font-medium">
                          No audit logs found
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {auditLogs.length === 0
                            ? "No audit logs have been recorded yet"
                            : "Try adjusting your search or filters"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-foreground">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </p>
                          <p className="text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getEventTypeBadge(log.event_type)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-mono text-foreground">
                          {log.id}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {log.event_data.email && (
                            <p className="text-foreground">
                              <span className="font-medium">Email:</span>{" "}
                              {log.event_data.email}
                            </p>
                          )}
                          {log.event_data.transaction_id && (
                            <p className="text-foreground">
                              <span className="font-medium">Transaction:</span>{" "}
                              {log.event_data.transaction_id}
                            </p>
                          )}
                          {log.event_data.amount && (
                            <p className="text-foreground">
                              <span className="font-medium">Amount:</span> ₦
                              {log.event_data.amount}
                            </p>
                          )}
                          {log.event_data.payer && (
                            <p className="text-muted-foreground text-xs">
                              Payer: {log.event_data.payer} → Payee:{" "}
                              {log.event_data.payee}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* Pagination */}
        {(hasPrevPage || hasNextPage) && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {currentPage}{totalPages > 1 ? ` of ${totalPages}` : ""}
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={(e) => {
                      e.preventDefault();
                      if (hasPrevPage) setCurrentPage((p) => p - 1);
                    }}
                    className={!hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={(e) => {
                      e.preventDefault();
                      if (hasNextPage) setCurrentPage((p) => p + 1);
                    }}
                    className={!hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
}
