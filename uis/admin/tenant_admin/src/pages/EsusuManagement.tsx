import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { listEsusuGroups } from "@/services/esusu";
import {
  DollarSign,
  Download,
  Search,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EsusuGroup {
  id: string;
  name: string;
  description: string;
  contribution_amount: number;
  currency: string;
  frequency: string;
  max_members: number;
  current_cycle: number;
  total_cycles: number;
  status: string;
  start_date: string;
  next_payout_date: string;
  members: any[];
  created_at: string;
  updated_at: string;
  currentMembers?: number;
  cycleNumber?: number;
  nextPayoutRecipient?: string;
  totalContributions?: number;
  totalPayouts?: number;
  branch?: string;
}

export default function EsusuManagement() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<EsusuGroup | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const { primaryColor } = useTenantBranding();

  const [esusuGroups, setEsusuGroups] = useState<EsusuGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    setLoading(true);
    listEsusuGroups(page, limit)
      .then(({ groups, total: t }) => {
        setEsusuGroups(groups || []);
        setTotal(t);
        setError(null);
      })
      .catch((err) => {
        setError(`Failed to load groups, ${err.message || err}`);
        setEsusuGroups([]);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filteredGroups = esusuGroups.filter((group) => {
    const matchesSearch =
      group.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.nextPayoutRecipient
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      false;
    const matchesStatus =
      filterStatus === "all" || group.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total,
    pending: esusuGroups.filter((g) => g.status === "PENDING").length,
    active: esusuGroups.filter((g) => g.status === "ACTIVE").length,
    completed: esusuGroups.filter((g) => g.status === "COMPLETED").length,
    totalValue: esusuGroups.reduce(
      (sum, g) => sum + (g.contribution_amount || 0),
      0,
    ),
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "completed":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getFrequencyLabel = (frequency: string): string => {
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportExcel = (): void => {
    const data = filteredGroups.map((group) => ({
      "Group ID": group.id,
      "Group Name": group.name,
      "Contribution Amount": group.contribution_amount,
      Frequency: getFrequencyLabel(group.frequency),
      Members: `${group.currentMembers || group.members?.length || 0}/${group.max_members}`,
      "Cycle Number": group.cycleNumber || group.current_cycle,
      "Next Payout Date": group.next_payout_date,
      "Next Recipient": group.nextPayoutRecipient || "N/A",
      "Total Contributions": group.totalContributions || 0,
      "Total Payouts": group.totalPayouts || 0,
      Status: group.status,
      "Created Date": group.created_at,
      Branch: group.branch || "N/A",
    }));
    exportToExcel(data, "esusu-groups");
    toast.success("Exported to Excel successfully");
  };

  const handleExportPDF = (): void => {
    const columns = [
      "Group ID",
      "Group Name",
      "Members",
      "Contribution",
      "Status",
    ];
    const data = filteredGroups.map((group) => ({
      "Group ID": group.id,
      "Group Name": group.name,
      Members: `${group.currentMembers || group.members?.length || 0}/${group.max_members}`,
      Contribution: formatCurrency(group.contribution_amount),
      Status: group.status,
    }));
    exportToPDF(data, columns, "esusu-groups", "Esusu Groups Report");
    toast.success("Exported to PDF successfully");
  };

  const handleManageGroup = (group: EsusuGroup) => {
    setSelectedGroup(group);
    setShowManageModal(true);
  };

  const handleProcessPayout = () => {
    if (selectedGroup) {
      toast.success(
        `Payout processed for ${selectedGroup.nextPayoutRecipient || "next member"}`,
      );
      setShowManageModal(false);
    }
  };

  const handleViewMembers = () => {
    setShowMembersModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Group Management"
          title="Esusu Management"
          description="Manage rotating savings groups and contributions"
          icon={<Users className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {stats.total}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total Groups
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.active}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Active Groups
                </div>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.pending}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Pending Groups
                </div>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.totalValue)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total Contributions
                </div>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by group name, ID, or member..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Excel
            </Button>
            <Button
              onClick={handleExportPDF}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Esusu Groups List */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading groups...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No groups found.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredGroups.map((group) => (
                <li
                  key={group.id}
                  className="p-6 hover:bg-muted/50 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {group.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {group.id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Description: {group.description}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cycles: {group.current_cycle}/{group.total_cycles}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 items-center">
                    <span className="text-sm">
                      Members: {group.members?.length ?? 0}/{group.max_members}
                    </span>
                    <span className="text-sm">
                      Contribution: {formatCurrency(group.contribution_amount)}
                    </span>
                    <span className="text-sm">
                      Status:{" "}
                      <span className={getStatusColor(group.status)}>
                        {group.status}
                      </span>
                    </span>
                    <span className="text-sm">
                      Start: {new Date(group.start_date).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageGroup(group)}
                    >
                      Manage
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(total / limit)} ({total} total)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>

        {/* Manage Esusu Group Modal */}
        {showManageModal && selectedGroup && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowManageModal(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Users className="w-6 h-6" style={{ color: primaryColor }} />
                  Manage Group - {selectedGroup.name}
                </h2>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Members</p>
                    <p className="font-semibold text-foreground">
                      {selectedGroup.currentMembers ||
                        selectedGroup.members?.length ||
                        0}
                      /{selectedGroup.max_members}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Contribution
                    </p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(selectedGroup.contribution_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Frequency</p>
                    <p className="font-semibold text-foreground">
                      {getFrequencyLabel(selectedGroup.frequency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Cycle Number
                    </p>
                    <p className="font-semibold text-foreground">
                      {selectedGroup.cycleNumber || selectedGroup.current_cycle}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Payout</p>
                    <p className="font-semibold text-foreground">
                      {selectedGroup.next_payout_date}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recipient</p>
                    <p className="font-semibold text-foreground">
                      {selectedGroup.nextPayoutRecipient || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {selectedGroup.status === "active" && (
                  <Button
                    onClick={handleProcessPayout}
                    style={{ backgroundColor: primaryColor }}
                    className="flex-1 text-white"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Process Payout
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleViewMembers}
                  className="flex-1"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  View Members
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowManageModal(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* View Members Modal */}
        {showMembersModal && selectedGroup && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowMembersModal(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <UserCheck
                    className="w-6 h-6"
                    style={{ color: primaryColor }}
                  />
                  Members of {selectedGroup.name}
                </h2>
                <button
                  onClick={() => setShowMembersModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Phone</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedGroup.members || []).map((member: any) => (
                      <tr key={member.id} className="border-b border-border">
                        <td className="px-4 py-2">{member.name || "-"}</td>
                        <td className="px-4 py-2">{member.role}</td>
                        <td className="px-4 py-2">{member.phone || "-"}</td>
                        <td className="px-4 py-2">{member.status}</td>
                        <td className="px-4 py-2">
                          {member.joined_at
                            ? new Date(member.joined_at).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!selectedGroup.members ||
                  selectedGroup.members.length === 0) && (
                  <div className="p-4 text-center text-muted-foreground">
                    No members found.
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowMembersModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
