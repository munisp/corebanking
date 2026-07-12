import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VerificationUrlModal } from "@/components/VerificationUrlModal";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { getAdmins, suspendAdmin, unsuspendAdmin } from "@/services/admin";
import { branchService, type Branch } from "@/services/branch";
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Loader2,
  Mail,
  MoreVertical,
  Phone,
  Search,
  Shield,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import PageHeader from "../../../components/PageHeader";
// Map old numeric access_level codes to named roles (legacy data)
const LEGACY_ROLE_MAP: Record<string, string> = {
  "0": "support_agent",
  "1": "loan_officer",
  "2": "relationship_manager",
  "3": "operations_manager",
  "4": "compliance_officer",
  "5": "risk_manager",
  "6": "internal_auditor",
  "7": "branch_manager",
  "8": "super_admin",
};

// Resolve access_level value to a named role string
function resolveAccessLevel(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  return LEGACY_ROLE_MAP[raw] ?? raw; // numeric → named; already named → keep
}

// Map a raw API admin record to the Admin interface
function mapApiAdmin(a: {
  id: string | number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  is_suspended?: boolean;
  is_verified?: boolean;
  created_at?: string;
  last_login?: string;
  access_level?: string | null;
  tenant_role?: string | null;
}): Admin {
  return {
    id: a.id,
    name: (a.first_name || "") + (a.last_name ? " " + a.last_name : ""),
    email: a.email || "",
    phone: a.phone || "",
    role: (a.role as Admin["role"]) || "admin",
    status: (a.is_suspended ? "suspended" : "active") as Admin["status"],
    isVerified: a.is_verified || false,
    createdAt: a.created_at || "",
    lastLogin: a.last_login || "",
    permissions: [],
    tenant_role: resolveAccessLevel(
      a.access_level ?? a.tenant_role ?? undefined,
    ),
  };
}

function toAdmins(data: any[]): Admin[] {
  return [...new Map((data || []).map((a) => [a.id, a])).values()].map(mapApiAdmin);
}

// Tenant role options (v2.perm `tenants` entity named roles)
const TENANT_ROLES = [
  { value: "support_agent", label: "Support Agent" },
  { value: "relationship_manager", label: "Relationship Manager" },
  { value: "loan_officer", label: "Loan Officer" },
  { value: "operations_manager", label: "Operations Manager" },
  { value: "trade_finance_admin", label: "Trade Finance Admin" },
  { value: "vault_manager", label: "Vault Manager" },
  { value: "treasury_manager", label: "Treasury Manager" },
  { value: "risk_manager", label: "Risk Manager" },
  { value: "compliance_officer", label: "Compliance Officer" },
  { value: "internal_auditor", label: "Internal Auditor" },
  { value: "it_admin", label: "IT Admin" },
  { value: "branch_manager", label: "Branch Manager" },
  { value: "super_admin", label: "Super Admin" },
];

interface Admin {
  id: string | number;
  name: string;
  email: string;
  phone: string;
  role: "super_admin" | "admin" | "viewer";
  status: "suspended" | "active";
  isVerified: boolean;
  createdAt: string | Date;
  lastLogin?: string | Date;
  permissions: string[];
  tenant_role?: string;
}

export default function AdminManagement() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVerification, setFilterVerification] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { primaryColor } = useTenantBranding();
  const [loading, setLoading] = useState(false);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    uin: "",
    password: "",
    tenant_role: "support_agent",
    branchId: "" as string,
    role: "viewer" as Admin["role"],
    status: "active" as Admin["status"],
    permissions: [] as string[],
  });
  const [branches, setBranches] = useState<Branch[]>([]);

  // Central fetch function — sends all filter + pagination params to the API
  const fetchAdmins = async (page = currentPage, limit = pageSize) => {
    setLoading(true);
    try {
      const { admins: data, total: count } = await getAdmins({
        page,
        limit,
        search: debouncedSearch || undefined,
        role: filterRole !== "all" ? filterRole : undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        verification: filterVerification !== "all" ? filterVerification : undefined,
      });
      setAdmins(toAdmins(data));
      setTotal(count);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search input (300 ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to page 1 when filters / search / pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterRole, filterStatus, filterVerification, pageSize]);

  // Re-fetch whenever page, pageSize, or any filter changes
  useEffect(() => {
    fetchAdmins(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, filterRole, filterStatus, filterVerification]);

  // Fetch branches once on mount
  useEffect(() => {
    branchService.getAllBranches().then(setBranches).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Add admin (API integration placeholder, implement as needed)
  const handleAddAdmin = async () => {
    try {
      setIsAddingAdmin(true);
      const payload = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        uin: formData.uin,
        password: formData.password,
        tenantRole: formData.tenant_role || "support_agent",
        ...(formData.branchId ? { branchId: formData.branchId } : {}),
      };
      const response = await (
        await import("@/services/admin")
      ).createAdmin(payload);

      if (response?.verification) {
        setVerificationUrl(response.verification);
        setVerificationEmail(formData.email);
        setIsVerificationModalOpen(true);
      }

      setIsAddDialogOpen(false);
      resetForm();
      fetchAdmins(currentPage, pageSize);
    } catch (e) {
      alert(`Failed to add admin., ${e}`);
    } finally {
      setIsAddingAdmin(false);
    }
  };

  // Edit admin (API integration placeholder, implement as needed)
  const handleEditAdmin = async () => {
    if (!selectedAdmin) return;
    setIsEditDialogOpen(false);
    setSelectedAdmin(null);
    resetForm();
    fetchAdmins(currentPage, pageSize);
  };

  // No delete endpoint provided, so just refetch
  const handleDeleteAdmin = async (adminId: string | number) => {
    alert(`Delete admin is not implemented. Admin ID: ${adminId}`);
  };

  // Suspend/unsuspend admin
  const handleToggleStatus = async (
    adminId: string | number,
    status: Admin["status"],
  ) => {
    try {
      if (status === "active") {
        await suspendAdmin(Number(adminId));
      } else {
        await unsuspendAdmin(Number(adminId));
      }
      fetchAdmins(currentPage, pageSize);
    } catch {
      // loading state cleared by fetchAdmins
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      uin: "",
      password: "",
      tenant_role: "support_agent",
      branchId: "",
      role: "viewer",
      status: "active",
      permissions: [],
    });
  };

  const openEditDialog = (admin: Admin) => {
    setSelectedAdmin(admin);
    const nameParts = admin.name.split(" ");
    setFormData({
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      email: admin.email,
      phone: admin.phone,
      uin: "",
      password: "",
      tenant_role: admin.tenant_role || "support_agent",
      branchId: "",
      role: admin.role,
      status: admin.status,
      permissions: admin.permissions,
    });
    setIsEditDialogOpen(true);
  };

  const getRoleBadge = (role: Admin["role"]) => {
    switch (role) {
      case "super_admin":
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700">
            Super Admin
          </Badge>
        );
      case "admin":
        return <Badge className="bg-blue-600 hover:bg-blue-700">Admin</Badge>;
      case "viewer":
        return <Badge className="bg-gray-600 hover:bg-gray-700">Viewer</Badge>;
    }
  };

  const stats = {
    total,
    active: admins.filter((a) => a.status === "active").length,
    verified: admins.filter((a) => a.isVerified).length,
    recentlyAdded: admins.filter((a) => {
      if (!a.createdAt) return false;
      const createdAt =
        typeof a.createdAt === "string" ? new Date(a.createdAt) : a.createdAt;
      if (!(createdAt instanceof Date) || isNaN(createdAt.getTime()))
        return false;
      const daysDiff =
        (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }).length,
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Admin Management"
          title="Admin Management"
          description="Manage administrator accounts and permissions"
          icon={<Shield className="w-8 h-8" />}
          action={{
            label: "Add Admin",
            onClick: () => setIsAddDialogOpen(true)
          }}
        />
      </div>

      <div className="container py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Total Admins
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.total}
                </p>
              </div>
              <Shield className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Active
                </p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {stats.active}
                </p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Verified
                </p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {stats.verified}
                </p>
              </div>
              <Shield className="w-12 h-12 text-purple-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Added (30d)
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.recentlyAdded}
                </p>
              </div>
              <Calendar className="w-12 h-12 text-orange-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search admins..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {TENANT_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterVerification}
              onValueChange={setFilterVerification}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Filter by verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verification</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground">
              Showing {total === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total} admins
            </div>
          </div>
        </div>

        {/* Admin List */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Access Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Verification
                  </th>
                  {/* <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Last Login
                  </th> */}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-muted-foreground font-medium">Loading admins...</p>
                      </div>
                    </td>
                  </tr>
                ) : admins.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Shield className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground font-medium">
                          No admins found
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {total === 0
                            ? "Get started by adding your first admin"
                            : "Try adjusting your search or filters"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                            {(admin.name || "")
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {admin.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ID: {admin.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            {admin.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            {admin.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getRoleBadge(admin.role)}</td>
                      <td className="px-6 py-4">
                        {(() => {
                          const role = admin.tenant_role;
                          if (!role) {
                            return (
                              <span className="text-sm text-muted-foreground italic">
                                Unassigned
                              </span>
                            );
                          }
                          const found = TENANT_ROLES.find(
                            (r) => r.value === role,
                          );
                          return (
                            <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 font-normal">
                              {found ? found.label : role}
                            </Badge>
                          );
                        })()}
                      </td>

                      <td className="px-6 py-4">
                        {admin.status === "active" ? (
                          <Badge className="bg-primary/10 text-primary">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/10 text-destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Suspended
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {admin.isVerified ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            Unverified
                          </Badge>
                        )}
                      </td>
                      {/* <td className="px-6 py-4 text-sm text-muted-foreground">
                        {admin.lastLogin
                          ? typeof admin.lastLogin === "string"
                            ? new Date(admin.lastLogin).toLocaleString()
                            : admin.lastLogin.toLocaleString()
                          : "Never"}
                      </td> */}
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(admin)}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleToggleStatus(admin.id, admin.status)
                              }
                            >
                              {admin.status === "active" ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Suspend
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Unsuspend
                                </>
                              )}
                            </DropdownMenuItem>
                            {/* <DropdownMenuItem
                              onClick={() => handleDeleteAdmin(admin.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem> */}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination footer */}
          {total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Admin Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
            <DialogDescription>
              Create a new administrator account with specific roles and
              permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="First Name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Last Name"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="uin">NIN</Label>
              <Input
                id="uin"
                value={formData.uin}
                onChange={(e) =>
                  setFormData({ ...formData, uin: e.target.value })
                }
                placeholder="0123456789"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john.doe@54link-dev.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+234 801 234 5678"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenant_role">Staff Role</Label>
              <Select
                value={formData.tenant_role}
                onValueChange={(value) =>
                  setFormData({ ...formData, tenant_role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff role" />
                </SelectTrigger>
                <SelectContent>
                  {TENANT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {branches.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="branchId">Assign to Branch <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, branchId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No branch — tenant-wide access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No branch — tenant-wide access</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={String(b.id)} value={String(b.id)}>
                        {b.name} <span className="text-muted-foreground text-xs ml-1">({b.code})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isAddingAdmin}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAdmin}
              disabled={isAddingAdmin}
              className="text-white hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              {isAddingAdmin ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Admin"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
            <DialogDescription>
              Update administrator account details and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-firstName">First Name</Label>
              <Input
                id="edit-firstName"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lastName">Last Name</Label>
              <Input
                id="edit-lastName"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as Admin["role"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as Admin["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditAdmin}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification URL Modal */}
      <VerificationUrlModal
        open={isVerificationModalOpen}
        onOpenChange={setIsVerificationModalOpen}
        verificationUrl={verificationUrl}
        email={verificationEmail}
      />
    </div>
  );
}
