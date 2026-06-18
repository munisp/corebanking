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
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import apiClient from "@/services/api";
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Mail,
  MoreVertical,
  Phone,
  Search,
  User,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
// ...existing code...
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";

interface ApplicationUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "agent" | "merchant" | "admin";
  status: "active" | "inactive" | "suspended";
  kycVerificationStatus?: "verified" | "pending" | "rejected";
  createdAt: Date;
  lastLogin?: Date;
  accountBalance?: number;
  totalTransactions?: number;
  keycloakId?: string;
}

interface UsersResponse {
  message?: string;
  users?: any[];
  data?: any[];
  [key: string]: any;
}

export default function UserManagement() {
  const [users, setUsers] = useState<ApplicationUser[]>([]);
  const [total, setTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ApplicationUser | null>(
    null,
  );
  const [filterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { primaryColor } = useTenantBranding();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "customer" as ApplicationUser["role"],
    status: "active" as ApplicationUser["status"],
  });

  const mapUser = (user: any): ApplicationUser => {
    let createdAt = new Date();
    if (user.created_at) {
      const dateStr = user.created_at.replace(" ", "T");
      const parsedDate = new Date(dateStr);
      createdAt = !isNaN(parsedDate.getTime()) ? parsedDate : (new Date(user.created_at) || new Date());
    }
    const roleMap: Record<string, ApplicationUser["role"]> = {
      user: "customer", customer: "customer", agent: "agent", merchant: "merchant", admin: "admin",
    };
    return {
      id: user.id || `user-${Date.now()}-${Math.random()}`,
      name: user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown User",
      email: user.email || "",
      phone: user.phone_number || user.phone || "",
      role: roleMap[user.user_role?.toLowerCase()] || roleMap[user.role?.toLowerCase()] || "customer",
      status: (user.status === "active" ? "active" : user.status === "suspended" ? "suspended" : "inactive") as ApplicationUser["status"],
      kycVerificationStatus: (user.kyc_verification_status || "pending") as ApplicationUser["kycVerificationStatus"],
      createdAt,
      lastLogin: undefined,
      accountBalance: 0,
      totalTransactions: 0,
      keycloakId: user.keycloak_id || user.keycloakId || user.id,
    };
  };

  // Fetch users from API with server-side pagination + filters
  const fetchUsers = async (page = currentPage, limit = pageSize, showLoading = true) => {
    if (showLoading) setUsersLoading(true);
    try {
      const response = await apiClient.get<UsersResponse | ApplicationUser[]>("/user/user/tenant", {
        params: {
          page,
          limit,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(filterStatus !== "all" ? { status: filterStatus } : {}),
        },
      });
      const data = response.data as any;
      let usersData: any[] = [];
      if (Array.isArray(data)) {
        usersData = data;
      } else if (Array.isArray(data.users)) {
        usersData = data.users;
      } else if (Array.isArray(data.data)) {
        usersData = data.data;
      }
      const serverTotal = data.total ?? data.totalCount ?? data.count ?? data.pagination?.total ?? usersData.length;
      setUsers(usersData.map(mapUser));
      setTotal(serverTotal);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      if (showLoading) toast.error(error?.response?.data?.message || error?.message || "Failed to fetch users");
      setUsers([]);
    } finally {
      if (showLoading) setUsersLoading(false);
    }
  };

  // Debounce search input (300 ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to page 1 when filters/search/pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterRole, filterStatus, pageSize]);

  // Re-fetch whenever page, pageSize, or filters change
  useEffect(() => {
    fetchUsers(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, filterStatus]);

  // Silent auto-refresh of current page every 30 s
  useEffect(() => {
    const interval = setInterval(() => fetchUsers(currentPage, pageSize, false), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, filterStatus]);

  const handleAddUser = () => {
    const newUser: ApplicationUser = {
      id: `user-${Date.now()}`,
      ...formData,
      createdAt: new Date(),
      accountBalance: 0,
      totalTransactions: 0,
    };
    setUsers([newUser, ...users]);
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEditUser = () => {
    if (!selectedUser) return;
    setUsers(
      users.map((user) =>
        user.id === selectedUser.id ? { ...user, ...formData } : user,
      ),
    );
    setIsEditDialogOpen(false);
    setSelectedUser(null);
    resetForm();
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((user) => user.id !== userId));
    }
  };

  // Activate or suspend user via API
  const handleToggleStatus = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    try {
      let endpoint = "";
      let action = "";
      if (user.status === "active") {
        endpoint = `/user/user/${userId}/suspend`;
        action = "suspend";
      } else {
        endpoint = `/user/user/${userId}/activate`;
        action = "activate";
      }
      await apiClient.put(endpoint);
      toast.success(
        `User ${action === "suspend" ? "suspended" : "activated"} successfully.`,
      );
      fetchUsers(currentPage, pageSize);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update user status";
      toast.error(errorMessage);
    }
  };

  // Perform liveness check for user
  const handleLivenessCheck = async (userId: string) => {
    try {
      console.log("Performing liveness check for user ID:", userId);
      toast.info("Initiating liveness check...");
      await apiClient.post(
        "/user/user/kyc/liveness-check",
        {},
        {
          headers: {
            "x-keycloak-id": userId,
            "x-user-id": userId,
            "x-user-role": "super_admin", // Assuming only admins can perform liveness checks; adjust as needed
          },
        },
      );
      toast.success("Liveness check completed successfully.");
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to perform liveness check";
      toast.error(errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "customer",
      status: "active",
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getRoleBadge = (role: ApplicationUser["role"]) => {
    switch (role) {
      case "admin":
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700">Admin</Badge>
        );
      case "merchant":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700">Merchant</Badge>
        );
      case "agent":
        return <Badge className="bg-green-600 hover:bg-green-700">Agent</Badge>;
      case "customer":
        return (
          <Badge className="bg-gray-600 hover:bg-gray-700">Customer</Badge>
        );
    }
  };

  const stats = {
    total,
    active: users.filter((u) => u.status === "active").length,
    suspendedCustomers: users.filter(
      (u) => u.role === "customer" && u.status === "suspended",
    ).length,
    recentlyAdded: users.filter((u) => {
      const daysDiff =
        (new Date().getTime() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="User Administration"
          title="User Management"
          description="Manage users in the application"
          icon={<User className="w-8 h-8" />}
          action={{
            label: "Add User",
            onClick: () => setIsAddDialogOpen(true),
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
                  Total Users
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.total}
                </p>
              </div>
              <User className="w-12 h-12 text-blue-600 opacity-20" />
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
                  Suspended Customers
                </p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">
                  {stats.suspendedCustomers}
                </p>
              </div>
              <User className="w-12 h-12 text-yellow-600 opacity-20" />
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
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="merchant">Merchant</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select> */}

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground">
              Showing {total === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total} users
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Status
                  </th>
                  {/* <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Account Balance
                  </th> */}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    KYC Status
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
                {usersLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-muted-foreground font-medium">
                          Loading users...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <User className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground font-medium">
                          No users found
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {total === 0
                            ? "Get started by adding your first user"
                            : "Try adjusting your search or filters"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                            {user.name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {user.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ID: {user.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            {user.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                      <td className="px-6 py-4">
                        {user.status === "active" ? (
                          <Badge className="bg-primary/10 text-primary">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : user.status === "suspended" ? (
                          <Badge className="bg-yellow-500/10 text-yellow-600">
                            <XCircle className="w-3 h-3 mr-1" />
                            Suspended
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/10 text-destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </td>
                      {/* <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-foreground">
                          ₦{user.accountBalance?.toLocaleString() || '0.00'}
                        </p>
                      </td> */}
                      <td className="px-6 py-4">
                        {user.kycVerificationStatus === "verified" ? (
                          <Badge className="bg-green-600/10 text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : user.kycVerificationStatus === "rejected" ? (
                          <Badge className="bg-red-600/10 text-red-600">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-600/10 text-yellow-600">
                            Pending
                          </Badge>
                        )}
                      </td>
                      {/* <td className="px-6 py-4 text-sm text-muted-foreground">
                        {user.lastLogin ? user.lastLogin.toLocaleString() : 'Never'}
                      </td> */}
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem> */}
                            <DropdownMenuItem
                              onClick={() =>
                                handleLivenessCheck(user.keycloakId || user.id)
                              }
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Liveness Check
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(user.id)}
                            >
                              {user.status === "active" ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600"
                            >
                              Delete
                            </DropdownMenuItem>
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

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account in the application.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
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
                placeholder="john.doe@example.com"
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
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    role: value as ApplicationUser["role"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="merchant">Merchant</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as ApplicationUser["status"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user account details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
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
                  setFormData({
                    ...formData,
                    role: value as ApplicationUser["role"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="merchant">Merchant</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as ApplicationUser["status"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
              onClick={handleEditUser}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
