import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { branchService, type Branch } from "@/services/branch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Building2,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    Plus,
    Search,
    TrendingUp,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function BankManagement() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { primaryColor } = useTenantBranding();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch branches from API
  const fetchBranches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await branchService.getAllBranches();
      setBranches(data);
    } catch (err: unknown) {
      console.error("Error fetching branches:", err);
      let message = "Failed to fetch branches";
      if (isErrorWithMessage(err)) {
        message = err.message;
      }
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Type guard for error with message
  function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    );
  }

  useEffect(() => {
    fetchBranches();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, pageSize]);

  const filteredBranches = branches.filter((branch: Branch) => {
    const matchesSearch =
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.contact?.email
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ??
        false);
    const matchesStatus =
      filterStatus === "all" || branch.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Client-side pagination
  const paginatedBranches = filteredBranches.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Calculate stats from branches
  const stats = {
    total: branches.length,
    active: branches.filter((b: Branch) => b.status === "active").length,
    pending: branches.filter((b: Branch) => b.status === "pending").length,
    suspended: branches.filter((b: Branch) => b.status === "suspended").length,
  };

  const getStatusColor = (status?: string): string => {
    switch (status) {
      case "active":
        return "bg-primary/10 text-primary";
      case "pending":
        return "bg-muted text-muted-foreground";
      case "suspended":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-foreground";
    }
  };

  const handleExportExcel = (): void => {
    const data = filteredBranches.map((branch: Branch) => ({
      "Branch Code": branch.code,
      Name: branch.name,
      Location: branch.location,
      Status: branch.status || "N/A",
      "Contact Name": branch.contact?.name || "",
      Email: branch.contact?.email || "",
      Phone: branch.contact?.phone || "",
      Created: branch.created_at
        ? new Date(branch.created_at).toLocaleDateString()
        : "N/A",
    }));
    exportToExcel(data, "branches");
  };

  const handleExportPDF = (): void => {
    const columns = ["Branch Code", "Name", "Location", "Status", "Created"];
    const data = filteredBranches.map((branch: Branch) => ({
      "Branch Code": branch.code,
      Name: branch.name,
      Location: branch.location,
      Status: branch.status || "N/A",
      Created: branch.created_at
        ? new Date(branch.created_at).toLocaleDateString()
        : "N/A",
    }));
    exportToPDF(data, columns, "branches-report", "Branches Report");
  };

  const handleViewDetails = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedBranch(null);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background ">
      <div className="container py-8">
        <PageHeader
          label="Branch Management"
          title="Branch Management"
          description="Manage all branches on the platform"
          icon={<Building2 className="w-8 h-8" />}
          action={{
            label: "Onboard Branch",
            onClick: () => (window.location.href = "/onboarding"),
          }}
        />
      </div>

      <div className="container py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {isLoading ? "..." : stats.total}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total branches
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {isLoading ? "..." : stats.active}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Active</div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          {/* <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {isLoading ? '...' : stats.pending}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Pending</div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Activity className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div> */}

          {/* Pending card removed (Activity icon not imported) */}
        </div>

        {/* Filters and Search */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, code, or email..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              PDF
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
              <p className="text-muted-foreground">Loading branches...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{error}</p>
              <Button
                onClick={fetchBranches}
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No branches found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Branch
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Features
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedBranches.map((branch) => (
                    <tr
                      key={branch.id || branch.code}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-semibold text-foreground">
                            {branch.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {branch.code}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground">
                          {branch.location}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(branch.status)} capitalize`}
                        >
                          {branch.status || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="text-foreground">
                            {branch.contact?.name || "N/A"}
                          </div>
                          <div className="text-muted-foreground">
                            {branch.contact?.email || "N/A"}
                          </div>
                          <div className="text-muted-foreground">
                            {branch.contact?.phone || "N/A"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {branch.feature_flags &&
                          branch.feature_flags.length > 0 ? (
                            branch.feature_flags.slice(0, 3).map((feature) => (
                              <span
                                key={feature.id}
                                className="px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                              >
                                {feature.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No features
                            </span>
                          )}
                          {branch.feature_flags &&
                            branch.feature_flags.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{branch.feature_flags.length - 3} more
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {branch.created_at
                          ? new Date(branch.created_at).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          onClick={() => handleViewDetails(branch)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {!isLoading && filteredBranches.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card rounded-b-xl">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {filteredBranches.length === 0 ? "No results" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredBranches.length)} of ${filteredBranches.length}`}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage * pageSize >= filteredBranches.length}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Branch Details Dialog */}
      {isDetailsOpen && selectedBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl border border-border max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Dialog Header */}
            <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <Building2
                    className="w-6 h-6"
                    style={{ color: primaryColor }}
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {selectedBranch.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Branch Code: {selectedBranch.code}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDetails}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div
                    className="w-1 h-5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Branch ID
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.id}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Tenant ID
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.tenant_id}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Location
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.location}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedBranch.status)} capitalize`}
                    >
                      {selectedBranch.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div
                    className="w-1 h-5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                  Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Contact Name
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.contact?.name || "N/A"}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.contact?.email || "N/A"}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Phone</p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.contact?.phone || "N/A"}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Contact ID
                    </p>
                    <p className="text-sm font-semibold text-foreground break-all">
                      {selectedBranch.contact?.id || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* URLs */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div
                    className="w-1 h-5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                  Integration URLs
                </h3>
                <div className="space-y-3">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Webhook URL
                    </p>
                    <p className="text-sm font-semibold text-foreground break-all">
                      {selectedBranch.webhook_url}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Callback URL
                    </p>
                    <p className="text-sm font-semibold text-foreground break-all">
                      {selectedBranch.callback_url}
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Flags */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div
                    className="w-1 h-5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                  Feature Flags ({selectedBranch.feature_flags?.length || 0})
                </h3>
                {selectedBranch.feature_flags &&
                selectedBranch.feature_flags.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedBranch.feature_flags.map((feature) => (
                      <div
                        key={feature.id}
                        className="bg-muted/30 rounded-lg p-4 border-l-4"
                        style={{
                          borderColor: feature.is_enabled
                            ? primaryColor
                            : "#888",
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-foreground capitalize">
                            {feature.name.replace(/_/g, " ")}
                          </p>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${feature.is_enabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
                          >
                            {feature.is_enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground break-all">
                          ID: {feature.id}
                        </p>
                        {Object.keys(feature.config).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-1">
                              Config:
                            </p>
                            <pre className="text-xs bg-background rounded p-2 overflow-x-auto">
                              {JSON.stringify(feature.config, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No feature flags configured
                  </p>
                )}
              </div>

              {/* Timestamps */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div
                    className="w-1 h-5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                  Timestamps
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Created At
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.created_at
                        ? new Date(selectedBranch.created_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Updated At
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.updated_at
                        ? new Date(selectedBranch.updated_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Deleted At
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBranch.deleted_at
                        ? new Date(selectedBranch.deleted_at).toLocaleString()
                        : "Not deleted"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="sticky bottom-0 bg-card border-t border-border p-6">
              <Button
                onClick={handleCloseDetails}
                className="w-full"
                style={{ backgroundColor: primaryColor }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
