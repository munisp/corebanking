import {
  queueService,
  tellerService,
  tillService,
  transactionService,
  transferService,
  vaultService,
} from "@/api/tellerApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CloseTillRequest,
  CreateTillRequest,
  CreateTillTransferRequest,
  CreateVaultRequest,
  DenominationBreakdown,
  ListTransactionsParams,
  OpenTillRequest,
  OpenVaultRequest,
  QueueStats,
  RegisterTellerRequest,
  StructuredDenominationBreakdown,
  Teller,
  Till,
  TillBalance,
  TillTransfer,
  Transaction,
  UpdateTellerAssignmentRequest,
  Vault as VaultType,
} from "@/types/teller";
import {
  Building,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  Eye,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";

const getTellerId = (teller: Teller): string => {
  const maybe = teller as Teller & { teller_id?: string };
  return maybe.id || maybe.teller_id || "";
};

type ApiErrorLike = {
  response?: {
    data?: {
      message?: unknown;
    };
  };
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as ApiErrorLike)?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
};

type AdminUser = {
  keycloak_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

export default function TellerManagement() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Teller Management"
          title="Teller Management"
          description="Manage tellers, tills, vaults, and operations"
          icon={<Users className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-6 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tellers">Tellers</TabsTrigger>
          <TabsTrigger value="tills">Tills</TabsTrigger>
          <TabsTrigger value="vaults">Vaults</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          {/* <TabsTrigger value="queue">Queue</TabsTrigger> */}
          {/* <TabsTrigger value="reports">Reports</TabsTrigger> */}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="tellers">
          <TellersTab />
        </TabsContent>

        <TabsContent value="tills">
          <TillsTab />
        </TabsContent>

        <TabsContent value="vaults">
          <VaultsTab />
        </TabsContent>

        <TabsContent value="transfers">
          <TransfersTab />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTab />
        </TabsContent>

        {/* <TabsContent value="queue">
          <QueueTab />
        </TabsContent> */}

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

// Tellers Tab Component

type OverviewStats = {
  activeTellers: number;
  openTills: number;
  totalVaults: number;
};

function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      const [tellersRes, tillsRes, vaultsRes, queueStatsRes] =
        await Promise.all([
          tellerService.listTellers({ status: "active" }),
          tillService.listTills({ status: "open" }),
          vaultService.listVaults(),
          queueService.getQueueStats(),
        ]);

      setStats({
        activeTellers: tellersRes.total,
        openTills: tillsRes.total,
        totalVaults: vaultsRes.total,
      });
      setQueueStats(queueStatsRes);
    } catch (error) {
      console.error("Error loading overview:", error);
      toast.error("Failed to load overview data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading overview...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Tellers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeTellers || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tills</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openTills || 0}</div>
            <p className="text-xs text-muted-foreground">In operation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vaults</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalVaults || 0}</div>
            <p className="text-xs text-muted-foreground">Total vaults</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queueStats?.total_waiting || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {queueStats?.total_serving || 0} being served
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Window Status */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Window Status</CardTitle>
          <CardDescription>
            Real-time status of all teller windows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Window</TableHead>
                <TableHead>Teller</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Served Today</TableHead>
                <TableHead>Avg. Service Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {windowStatus.map((window) => (
                <TableRow key={window.window_number}>
                  <TableCell className="font-medium">
                    {window.window_number}
                  </TableCell>
                  <TableCell>{window.teller_name || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        window.status === "available"
                          ? "default"
                          : window.status === "busy"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {window.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{window.tickets_served_today}</TableCell>
                  <TableCell>
                    {(window.average_service_time ?? 0).toFixed(1)} min
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card> */}

      {/* Queue Statistics */}
      {/* {queueStats && (
        <Card>
          <CardHeader>
            <CardTitle>Queue Statistics</CardTitle>
            <CardDescription>Customer queue metrics for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Waiting</p>
                <p className="text-2xl font-bold">{queueStats.total_waiting}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Being Served</p>
                <p className="text-2xl font-bold">{queueStats.total_serving}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold">
                  {queueStats.total_completed_today}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Wait Time</p>
                <p className="text-2xl font-bold">
                  {(queueStats.average_wait_time ?? 0).toFixed(1)} min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )} */}
    </div>
  );
}
function TellersTab() {
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedTeller, setSelectedTeller] = useState<Teller | null>(null);

  useEffect(() => {
    loadTellers();
  }, []);

  const loadTellers = async () => {
    try {
      setLoading(true);
      const response = await tellerService.listTellers();
      setTellers(response.data);
    } catch (error) {
      console.error("Error loading tellers:", error);
      toast.error("Failed to load tellers");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeller = async (data: RegisterTellerRequest) => {
    try {
      await tellerService.registerTeller(data);
      toast.success("Teller registered successfully");
      setShowCreateDialog(false);
      loadTellers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to register teller"));
    }
  };

  const handleUpdateStatus = async (
    tellerId: string,
    status: Teller["status"],
  ) => {
    try {
      await tellerService.updateTellerStatus(tellerId, {
        status,
      });
      toast.success("Teller status updated");
      loadTellers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update status"));
    }
  };

  const handleAssignTeller = async (data: UpdateTellerAssignmentRequest) => {
    const selectedTellerId = selectedTeller ? getTellerId(selectedTeller) : "";
    if (!selectedTeller || !selectedTellerId) {
      toast.error("No teller selected or teller ID missing");
      return;
    }
    try {
      await tellerService.updateTellerAssignment(selectedTellerId, data);
      toast.success("Teller assignment updated");
      setShowAssignDialog(false);
      setSelectedTeller(null);
      loadTellers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update assignment"));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive",
      on_break: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8">Loading tellers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tellers</h2>
          <p className="text-gray-500">
            Manage teller accounts and assignments
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Register Teller
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <CreateTellerDialog
              onSubmit={handleCreateTeller}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teller ID</TableHead>
                <TableHead>Employee #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Till</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tellers.map((teller) => (
                <TableRow key={getTellerId(teller) || teller.user_id}>
                  <TableCell className="font-medium">
                    {getTellerId(teller) || "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {teller.employee_number}
                  </TableCell>
                  <TableCell>
                    {teller.first_name} {teller.last_name}
                  </TableCell>
                  <TableCell>{teller.email}</TableCell>
                  <TableCell>{teller.phone}</TableCell>
                  <TableCell>{teller.window_number || "-"}</TableCell>
                  <TableCell>{teller.assigned_till_id || "-"}</TableCell>
                  <TableCell>{getStatusBadge(teller.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTeller(teller);
                          setShowAssignDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Select
                        value={teller.status}
                        onValueChange={(value) =>
                          handleUpdateStatus(
                            getTellerId(teller),
                            value as Teller["status"],
                          )
                        }
                      >
                        <SelectTrigger className="w-30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on_break">On Break</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <AssignTellerDialog
            teller={selectedTeller}
            onSubmit={handleAssignTeller}
            onCancel={() => {
              setShowAssignDialog(false);
              setSelectedTeller(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Tills Tab Component
function TillsTab() {
  const [tills, setTills] = useState<Till[]>([]);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [selectedTill, setSelectedTill] = useState<Till | null>(null);
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadTills();
    loadTellers();
  }, []);

  const loadTills = async () => {
    try {
      setLoading(true);
      const response = await tillService.listTills();
      setTills(response.data);
    } catch (error) {
      console.error("Error loading tills:", error);
      toast.error("Failed to load tills");
    } finally {
      setLoading(false);
    }
  };

  const loadTellers = async () => {
    try {
      const response = await tellerService.listTellers({ status: "active" });
      setTellers(response.data);
    } catch (error) {
      console.error("Error loading tellers:", error);
    }
  };

  const handleCreateTill = async (data: CreateTillRequest) => {
    try {
      await tillService.createTill(data);
      toast.success("Till created successfully");
      setShowCreateDialog(false);
      loadTills();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to create till"));
    }
  };

  const handleOpenTill = async (tillId: string, data: OpenTillRequest) => {
    try {
      await tillService.openTill(tillId, data);
      toast.success("Till opened successfully");
      setShowOpenDialog(false);
      setSelectedTill(null);
      loadTills();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to open till"));
    }
  };

  const handleCloseTill = async (tillId: string, data: CloseTillRequest) => {
    try {
      await tillService.closeTill(tillId, data);
      toast.success("Till closed successfully");
      setShowCloseDialog(false);
      setSelectedTill(null);
      loadTills();
    } catch (error: unknown) {
      const maybeAxiosError = error as {
        response?: { data?: { message?: unknown } };
      };
      const message = maybeAxiosError?.response?.data?.message;
      toast.error(
        (typeof message === "string" && message) || "Failed to close till",
      );
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  if (loading) {
    return <div className="text-center py-8">Loading tills...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tills</h2>
          <p className="text-gray-500">Manage cash drawers and till balances</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <DollarSign className="mr-2 h-4 w-4" />
              Create Till
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateTillDialog
              onSubmit={handleCreateTill}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tills.map((till) => {
          const ngnBalance = (till.balances?.NGN || {}) as Partial<TillBalance>;
          return (
            <Card key={till.till_id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{`Till ID: ${till.till_id}`}</CardTitle>
                    <CardDescription>
                      {`Window #: ${till.window_number}`}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      till.status === "open"
                        ? "default"
                        : till.status === "closed"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {till.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">
                    Current Balance:
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(ngnBalance.current_balance || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Deposits:</span>
                  <span className="text-green-600">
                    {formatCurrency(ngnBalance.total_deposits || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Withdrawals:</span>
                  <span className="text-red-600">
                    {formatCurrency(ngnBalance.total_withdrawals || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">
                    Opening Balance:
                  </span>
                  <span>{formatCurrency(ngnBalance.opening_balance || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Shortage:</span>
                  <span className="text-red-600">
                    {formatCurrency(till.shortage_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Overage:</span>
                  <span className="text-green-600">
                    {formatCurrency(till.overage_amount || 0)}
                  </span>
                </div>
                {till.status === "closed" && (
                  <Button
                    className="mt-2"
                    onClick={() => {
                      setSelectedTill(till);
                      setShowOpenDialog(true);
                    }}
                  >
                    Open Till
                  </Button>
                )}

                {till.status === "open" && (
                  <Button
                    className="mt-2"
                    variant="destructive"
                    onClick={() => {
                      setSelectedTill(till);
                      setShowCloseDialog(true);
                    }}
                  >
                    Close Till
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Open Till Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent>
          {showOpenDialog && (
            <OpenTillDialog
              key={selectedTill?.till_id ?? "no-till"}
              till={selectedTill}
              tellers={tellers}
              onSubmit={(data) => {
                if (selectedTill) handleOpenTill(selectedTill.till_id, data);
              }}
              onCancel={() => {
                setShowOpenDialog(false);
                setSelectedTill(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Close Till Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          {showCloseDialog && (
            <CloseTillDialog
              key={selectedTill?.till_id ?? "no-till"}
              till={selectedTill}
              tellers={tellers}
              onSubmit={(data) => {
                if (selectedTill) handleCloseTill(selectedTill.till_id, data);
              }}
              onCancel={() => {
                setShowCloseDialog(false);
                setSelectedTill(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CloseTillDialog({
  till,
  tellers,
  onSubmit,
  onCancel,
}: {
  till: Till | null;
  tellers: Teller[];
  onSubmit: (data: CloseTillRequest) => void;
  onCancel: () => void;
}) {
  type CloseTillFormState = {
    teller_id: string;
    closing_cash: number;
    denomination_breakdown: DenominationBreakdown;
    notes?: string;
  };

  const defaultTellerId = till?.teller_id || "";

  const [formData, setFormData] = useState<CloseTillFormState>({
    teller_id: defaultTellerId,
    closing_cash: 0,
    denomination_breakdown: {
      n1000: 0,
      n500: 0,
      n200: 0,
      n100: 0,
      n50: 0,
      n20: 0,
      n10: 0,
      n5: 0,
    } as DenominationBreakdown,
  });

  const buildBackendBreakdown = (): StructuredDenominationBreakdown => {
    const currency = "NGN";
    const parts: Array<{ key: keyof DenominationBreakdown; value: number }> = [
      { key: "n1000", value: 1000 },
      { key: "n500", value: 500 },
      { key: "n200", value: 200 },
      { key: "n100", value: 100 },
      { key: "n50", value: 50 },
      { key: "n20", value: 20 },
      { key: "n10", value: 10 },
      { key: "n5", value: 5 },
    ];

    const denominations: StructuredDenominationBreakdown["denominations"] =
      parts
        .map(({ key, value }) => {
          const count = formData.denomination_breakdown[key];
          return {
            value,
            currency,
            count,
            total: value * count,
          };
        })
        .filter((d) => d.count > 0);

    const total_amount = denominations.reduce((sum, d) => sum + d.total, 0);
    const total_count = denominations.reduce((sum, d) => sum + d.count, 0);

    return {
      currency,
      denominations,
      total_amount,
      total_count,
    };
  };

  const canSubmit = Boolean(formData.teller_id);

  const handleSubmit = () => {
    if (!formData.teller_id) {
      toast.error("Please select a teller");
      return;
    }

    if (till?.teller_id && formData.teller_id !== till.teller_id) {
      toast.error("Selected teller is not assigned to this till");
      return;
    }

    if (Number.isNaN(formData.closing_cash) || formData.closing_cash < 0) {
      toast.error("Closing cash must be 0 or more");
      return;
    }

    const backendBreakdown = buildBackendBreakdown();
    if (backendBreakdown.total_amount !== formData.closing_cash) {
      toast.error(
        `Denomination total (${backendBreakdown.total_amount}) must match closing cash (${formData.closing_cash})`,
      );
      return;
    }

    onSubmit({
      teller_id: formData.teller_id,
      closing_cash: formData.closing_cash,
      denomination_breakdown: backendBreakdown,
      notes: formData.notes,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Close Till</DialogTitle>
        <DialogDescription>
          Close till {till?.till_id} (Window #{till?.window_number})
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="close_teller_id">Teller</Label>
          <Select
            value={formData.teller_id}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                teller_id: value,
              }))
            }
            disabled={Boolean(till?.teller_id)}
          >
            <SelectTrigger id="close_teller_id">
              <SelectValue placeholder="Select teller..." />
            </SelectTrigger>
            <SelectContent>
              {tellers
                .map((t) => ({ teller: t, tellerId: getTellerId(t) }))
                .filter(({ tellerId }) => Boolean(tellerId))
                .map(({ teller, tellerId }) => (
                  <SelectItem key={tellerId} value={tellerId}>
                    {teller.first_name} {teller.last_name} (
                    {teller.employee_number})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="closing_cash">Closing Cash (₦)</Label>
          <Input
            id="closing_cash"
            type="number"
            value={formData.closing_cash}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                closing_cash: Number(e.target.value) || 0,
              }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label>Denomination Breakdown</Label>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(formData.denomination_breakdown).map((denom) => (
              <div key={denom} className="flex flex-col items-center">
                <span className="text-xs font-medium">
                  ₦{denom.replace("n", "")}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={
                    formData.denomination_breakdown[
                      denom as keyof typeof formData.denomination_breakdown
                    ]
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      denomination_breakdown: {
                        ...prev.denomination_breakdown,
                        [denom]: parseInt(e.target.value, 10) || 0,
                      },
                    }))
                  }
                  className="w-16"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Close Till
        </Button>
      </DialogFooter>
    </>
  );
}

// Open Till Dialog Component
function OpenTillDialog({
  till,
  tellers,
  onSubmit,
  onCancel,
}: {
  till: Till | null;
  tellers: Teller[];
  onSubmit: (data: OpenTillRequest) => void;
  onCancel: () => void;
}) {
  type OpenTillFormState = {
    teller_id: string;
    opening_cash: number;
    denomination_breakdown: DenominationBreakdown;
  };

  const [formData, setFormData] = useState<OpenTillFormState>({
    teller_id: "",
    opening_cash: 0,
    denomination_breakdown: {
      n1000: 0,
      n500: 0,
      n200: 0,
      n100: 0,
      n50: 0,
      n20: 0,
      n10: 0,
      n5: 0,
    } as DenominationBreakdown,
  });

  const canSubmit = Boolean(formData.teller_id);

  const buildBackendBreakdown = (): StructuredDenominationBreakdown => {
    const currency = "NGN";
    const parts: Array<{ key: keyof DenominationBreakdown; value: number }> = [
      { key: "n1000", value: 1000 },
      { key: "n500", value: 500 },
      { key: "n200", value: 200 },
      { key: "n100", value: 100 },
      { key: "n50", value: 50 },
      { key: "n20", value: 20 },
      { key: "n10", value: 10 },
      { key: "n5", value: 5 },
    ];

    const denominations: StructuredDenominationBreakdown["denominations"] =
      parts
        .map(({ key, value }) => {
          const count = formData.denomination_breakdown[key];
          return {
            value,
            currency,
            count,
            total: value * count,
          };
        })
        .filter((d) => d.count > 0);

    const total_amount = denominations.reduce((sum, d) => sum + d.total, 0);
    const total_count = denominations.reduce((sum, d) => sum + d.count, 0);

    return {
      currency,
      denominations,
      total_amount,
      total_count,
    };
  };

  const handleSubmit = () => {
    if (!formData.teller_id) {
      toast.error("Please select a teller");
      return;
    }

    if (Number.isNaN(formData.opening_cash) || formData.opening_cash < 0) {
      toast.error("Opening cash must be 0 or more");
      return;
    }

    const backendBreakdown = buildBackendBreakdown();
    if (backendBreakdown.total_amount !== formData.opening_cash) {
      toast.error(
        `Denomination total (${backendBreakdown.total_amount}) must match opening cash (${formData.opening_cash})`,
      );
      return;
    }

    onSubmit({
      teller_id: formData.teller_id,
      opening_cash: formData.opening_cash,
      denomination_breakdown: backendBreakdown,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Open Till</DialogTitle>
        <DialogDescription>
          Open till {till?.till_id} (Window #{till?.window_number})
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="teller_id">Teller</Label>
          <Select
            value={formData.teller_id}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                teller_id: value,
              }))
            }
          >
            <SelectTrigger id="teller_id">
              <SelectValue placeholder="Select teller..." />
            </SelectTrigger>
            <SelectContent>
              {tellers
                .map((t) => ({ teller: t, tellerId: getTellerId(t) }))
                .filter(({ tellerId }) => Boolean(tellerId))
                .map(({ teller, tellerId }) => (
                  <SelectItem key={tellerId} value={tellerId}>
                    {teller.first_name} {teller.last_name} (
                    {teller.employee_number})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="opening_cash">Opening Cash (₦)</Label>
          <Input
            id="opening_cash"
            type="number"
            value={formData.opening_cash}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                opening_cash: Number(e.target.value) || 0,
              }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label>Denomination Breakdown</Label>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(formData.denomination_breakdown).map((denom) => (
              <div key={denom} className="flex flex-col items-center">
                <span className="text-xs font-medium">
                  ₦{denom.replace("n", "")}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={
                    formData.denomination_breakdown[
                      denom as keyof typeof formData.denomination_breakdown
                    ]
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      denomination_breakdown: {
                        ...prev.denomination_breakdown,
                        [denom]: parseInt(e.target.value, 10) || 0,
                      },
                    }))
                  }
                  className="w-16"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          Open Till
        </Button>
      </DialogFooter>
    </>
  );
}

// Vaults Tab Component
function VaultsTab() {
  const [vaults, setVaults] = useState<VaultType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [openingVault, setOpeningVault] = useState<VaultType | null>(null);
  const [openVaultLoading, setOpenVaultLoading] = useState(false);
  const [openVaultForm, setOpenVaultForm] = useState<OpenVaultRequest>({
    custodian_1_id: "",
    custodian_2_id: "",
  });
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [custodian1Search, setCustodian1Search] = useState("");
  const [custodian2Search, setCustodian2Search] = useState("");

  useEffect(() => {
    loadVaults();
  }, []);

  useEffect(() => {
    import("@/services/admin").then(({ getAdmins }) => {
      getAdmins()
        .then(setAdmins)
        .catch(() => setAdmins([]));
    });
  }, []);

  const loadVaults = async () => {
    try {
      setLoading(true);
      const response = await vaultService.listVaults();
      setVaults(response.data);
    } catch (error) {
      console.error("Error loading vaults:", error);
      toast.error("Failed to load vaults");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVault = async (data: CreateVaultRequest) => {
    try {
      await vaultService.createVault(data);
      toast.success("Vault created successfully");
      setShowCreateDialog(false);
      loadVaults();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to create vault"));
    }
  };

  const getVaultId = (vault: VaultType): string => {
    const maybe = vault as VaultType & { id?: string };
    return vault.vault_id || maybe.id || "";
  };

  const openVaultDialogFor = (vault: VaultType) => {
    setOpeningVault(vault);
    setOpenVaultForm({ custodian_1_id: "", custodian_2_id: "" });
    setCustodian1Search("");
    setCustodian2Search("");
    setShowOpenDialog(true);
  };

  const handleOpenVault = async () => {
    if (!openingVault) return;
    const vaultId = getVaultId(openingVault);
    if (!vaultId) {
      toast.error("Vault ID not found");
      return;
    }

    const requiresDualControl = Boolean(
      (openingVault.requires_dual_control ??
        openingVault.dual_control_required) === true,
    );

    const custodian1 = openVaultForm.custodian_1_id?.trim();
    const custodian2 = openVaultForm.custodian_2_id?.trim();
    if (!custodian1) {
      toast.error("Custodian 1 ID is required");
      return;
    }
    if (requiresDualControl && !custodian2) {
      toast.error("Dual control required: please select Custodian 2");
      return;
    }

    setOpenVaultLoading(true);
    try {
      await vaultService.openVault(vaultId, {
        custodian_1_id: custodian1,
        custodian_2_id: custodian2 ? custodian2 : undefined,
      });
      toast.success("Vault opened successfully");
      setShowOpenDialog(false);
      setOpeningVault(null);
      loadVaults();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to open vault"));
    } finally {
      setOpenVaultLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const formatAdminLabel = (a: AdminUser): string => {
    const name = `${a.first_name || ""} ${a.last_name || ""}`.trim();
    if (name && a.email) return `${name} (${a.email})`;
    if (name) return name;
    if (a.email) return a.email;
    return a.keycloak_id;
  };

  const matchesAdminSearch = (a: AdminUser, q: string): boolean => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return (
      (a.first_name || "").toLowerCase().includes(query) ||
      (a.last_name || "").toLowerCase().includes(query) ||
      (a.email || "").toLowerCase().includes(query) ||
      a.keycloak_id.toLowerCase().includes(query)
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading vaults...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Vaults</h2>
          <p className="text-gray-500">Manage branch vaults and balances</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Building className="mr-2 h-4 w-4" />
              Create Vault
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateVaultDialog
              onSubmit={handleCreateVault}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vaults.map((vault) => (
          <Card key={vault.vault_id || vault.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    {vault.vault_name || vault.vault_number || vault.vault_id}
                  </CardTitle>
                  <CardDescription>
                    {(vault.requires_dual_control ??
                    vault.dual_control_required)
                      ? "Dual Control"
                      : "Single Control"}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    vault.status === "open"
                      ? "default"
                      : vault.status === "closed"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {vault.status}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-2">
              {(() => {
                const ngn = vault.balances?.NGN;
                const current =
                  ngn?.current_balance ?? vault.current_balance ?? 0;
                const available =
                  ngn?.available_balance ?? vault.available_balance ?? 0;
                const reserved =
                  ngn?.reserved_balance ?? vault.reserved_balance ?? 0;

                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">
                        Current Balance:
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(current)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Available:</span>
                      <span className="text-green-600">
                        {formatCurrency(available)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Reserved:</span>
                      <span className="text-yellow-600">
                        {formatCurrency(reserved)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Minimum:</span>
                      <span className="text-gray-600">
                        {formatCurrency(vault.minimum_balance)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </CardContent>

            <CardFooter className="border-t justify-end gap-2">
              {vault.status === "closed" && (
                <Button size="sm" onClick={() => openVaultDialogFor(vault)}>
                  Open Vault
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog
        open={showOpenDialog}
        onOpenChange={(open) => {
          setShowOpenDialog(open);
          if (!open) {
            setOpeningVault(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Open Vault
              {openingVault?.vault_name ? ` - ${openingVault.vault_name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Select custodians to open this vault.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custodian_1_id">Custodian 1</Label>
              <Input
                id="custodian_1_search"
                placeholder="Search admin by name, email, or id"
                value={custodian1Search}
                onChange={(e) => setCustodian1Search(e.target.value)}
              />
              <Select
                value={openVaultForm.custodian_1_id}
                onValueChange={(val) =>
                  setOpenVaultForm((prev) => ({
                    ...prev,
                    custodian_1_id: val,
                    custodian_2_id:
                      prev.custodian_2_id === val ? "" : prev.custodian_2_id,
                  }))
                }
              >
                <SelectTrigger id="custodian_1_id">
                  <SelectValue placeholder="Select custodian..." />
                </SelectTrigger>
                <SelectContent>
                  {admins
                    .filter((a) => matchesAdminSearch(a, custodian1Search))
                    .map((a) => (
                      <SelectItem key={a.keycloak_id} value={a.keycloak_id}>
                        {formatAdminLabel(a)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {(() => {
                const requiresDualControl = Boolean(
                  (openingVault?.requires_dual_control ??
                    openingVault?.dual_control_required) === true,
                );
                return (
                  <Label htmlFor="custodian_2_id">
                    Custodian 2{" "}
                    {requiresDualControl ? "(required)" : "(optional)"}
                  </Label>
                );
              })()}
              <Input
                id="custodian_2_search"
                placeholder="Search admin by name, email, or id"
                value={custodian2Search}
                onChange={(e) => setCustodian2Search(e.target.value)}
              />
              {(() => {
                const requiresDualControl = Boolean(
                  (openingVault?.requires_dual_control ??
                    openingVault?.dual_control_required) === true,
                );
                const selectValue = requiresDualControl
                  ? openVaultForm.custodian_2_id
                  : openVaultForm.custodian_2_id || "__none__";
                return (
                  <Select
                    value={selectValue}
                    onValueChange={(val) =>
                      setOpenVaultForm((prev) => ({
                        ...prev,
                        custodian_2_id: val === "__none__" ? "" : val,
                      }))
                    }
                  >
                    <SelectTrigger id="custodian_2_id">
                      <SelectValue placeholder="Select second custodian (optional)..." />
                    </SelectTrigger>
                    <SelectContent>
                      {!requiresDualControl && (
                        <SelectItem value="__none__">None</SelectItem>
                      )}
                      {admins
                        .filter(
                          (a) => a.keycloak_id !== openVaultForm.custodian_1_id,
                        )
                        .filter((a) => matchesAdminSearch(a, custodian2Search))
                        .map((a) => (
                          <SelectItem key={a.keycloak_id} value={a.keycloak_id}>
                            {formatAdminLabel(a)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowOpenDialog(false)}
              disabled={openVaultLoading}
            >
              Cancel
            </Button>
            {(() => {
              const requiresDualControl = Boolean(
                (openingVault?.requires_dual_control ??
                  openingVault?.dual_control_required) === true,
              );
              const custodian1 = openVaultForm.custodian_1_id?.trim();
              const custodian2 = openVaultForm.custodian_2_id?.trim();
              const canOpen =
                Boolean(custodian1) &&
                (!requiresDualControl || Boolean(custodian2));
              return (
                <Button
                  onClick={handleOpenVault}
                  disabled={openVaultLoading || !canOpen}
                >
                  {openVaultLoading ? "Opening..." : "Open Vault"}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Transfers Tab Component
function TransfersTab() {
  const [transfers, setTransfers] = useState<TillTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const response = await transferService.listTillTransfers();
      setTransfers(response.data);
    } catch (error) {
      console.error("Error loading transfers:", error);
      toast.error("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transferId: string) => {
    try {
      await transferService.approveTillTransfer(transferId);
      toast.success("Transfer approved");
      loadTransfers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to approve transfer"));
    }
  };

  const handleReject = async (transferId: string, reason: string) => {
    try {
      await transferService.rejectTillTransfer(transferId, reason);
      toast.success("Transfer rejected");
      loadTransfers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to reject transfer"));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const safeHumanize = (value: unknown) => {
    return typeof value === "string" && value ? value.replace(/_/g, " ") : "-";
  };

  const safeDate = (value: unknown) => {
    if (typeof value !== "string" || !value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };

  if (loading) {
    return <div className="text-center py-8">Loading transfers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Till/Vault Transfers</h2>
          <p className="text-gray-500">Monitor and approve cash transfers</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>Create Transfer</Button>
          </DialogTrigger>
          <DialogContent>
            <CreateTransferDialog
              onSuccess={() => {
                setShowCreateDialog(false);
                loadTransfers();
              }}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => {
                const raw = transfer as unknown as Record<string, unknown>;
                const transferId =
                  (typeof raw.id === "string" && raw.id) ||
                  (typeof raw.transfer_id === "string" && raw.transfer_id) ||
                  "";
                const transferTypeRaw =
                  raw.transfer_type ?? raw.type ?? raw.transferType;
                const createdAtRaw = raw.created_at ?? raw.createdAt;
                const amountRaw = raw.amount;
                const amount =
                  typeof amountRaw === "number"
                    ? amountRaw
                    : typeof amountRaw === "string"
                      ? Number(amountRaw)
                      : transfer.amount;

                return (
                  <TableRow
                    key={
                      transferId ||
                      `${transfer.source_id}-${transfer.destination_id}-${String(createdAtRaw ?? "")}`
                    }
                  >
                    <TableCell className="font-medium">
                      {safeHumanize(transferTypeRaw)}
                    </TableCell>
                    <TableCell>
                      {transfer.source_type}: {transfer.source_id}
                    </TableCell>
                    <TableCell>
                      {transfer.destination_type}: {transfer.destination_id}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(Number.isFinite(amount) ? amount : 0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transfer.status === "completed"
                            ? "default"
                            : transfer.status === "pending"
                              ? "outline"
                              : transfer.status === "approved"
                                ? "secondary"
                                : "destructive"
                        }
                      >
                        {transfer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{safeDate(createdAtRaw)}</TableCell>
                    <TableCell>
                      {transfer.status === "pending" && transferId && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(transferId)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleReject(transferId, "Rejected by admin")
                            }
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateTransferDialog({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  type TransferFormState = {
    transfer_type: CreateTillTransferRequest["transfer_type"];
    source_id: string;
    destination_id: string;
    amount: number;
    denomination_breakdown: DenominationBreakdown;
    notes?: string;
  };

  const [tills, setTills] = useState<Till[]>([]);
  const [vaults, setVaults] = useState<VaultType[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<TransferFormState>({
    transfer_type: "till_to_vault",
    source_id: "",
    destination_id: "",
    amount: 0,
    denomination_breakdown: {
      n1000: 0,
      n500: 0,
      n200: 0,
      n100: 0,
      n50: 0,
      n20: 0,
      n10: 0,
      n5: 0,
    },
    notes: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [tillsRes, vaultsRes] = await Promise.all([
          tillService.listTills(),
          vaultService.listVaults(),
        ]);
        setTills(tillsRes.data);
        setVaults(vaultsRes.data);
      } catch (error: unknown) {
        const maybeAxiosError = error as {
          response?: { data?: { message?: unknown } };
        };
        const message = maybeAxiosError?.response?.data?.message;
        toast.error(
          (typeof message === "string" && message) ||
            "Failed to load tills and vaults",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const buildBackendBreakdown = (): StructuredDenominationBreakdown => {
    const currency = "NGN";
    const parts: Array<{ key: keyof DenominationBreakdown; value: number }> = [
      { key: "n1000", value: 1000 },
      { key: "n500", value: 500 },
      { key: "n200", value: 200 },
      { key: "n100", value: 100 },
      { key: "n50", value: 50 },
      { key: "n20", value: 20 },
      { key: "n10", value: 10 },
      { key: "n5", value: 5 },
    ];

    const denominations: StructuredDenominationBreakdown["denominations"] =
      parts
        .map(({ key, value }) => {
          const count = formData.denomination_breakdown[key];
          return {
            value,
            currency,
            count,
            total: value * count,
          };
        })
        .filter((d) => d.count > 0);

    const total_amount = denominations.reduce((sum, d) => sum + d.total, 0);
    const total_count = denominations.reduce((sum, d) => sum + d.count, 0);

    return {
      currency,
      denominations,
      total_amount,
      total_count,
    };
  };

  const sourceType: CreateTillTransferRequest["source_type"] =
    formData.transfer_type === "vault_to_till" ? "vault" : "till";
  const destinationType: CreateTillTransferRequest["destination_type"] =
    formData.transfer_type === "till_to_vault" ? "vault" : "till";

  const sourceOptions =
    sourceType === "till" ? tills.filter((t) => t.status === "open") : vaults;
  const destinationOptions = destinationType === "till" ? tills : vaults;

  const handleSubmit = async () => {
    if (!formData.source_id || !formData.destination_id) {
      toast.error("Please select source and destination");
      return;
    }

    if (formData.source_id === formData.destination_id) {
      toast.error("Source and destination must be different");
      return;
    }

    if (Number.isNaN(formData.amount) || formData.amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    const backendBreakdown = buildBackendBreakdown();
    if (backendBreakdown.total_amount !== formData.amount) {
      toast.error(
        `Denomination total (${backendBreakdown.total_amount}) must match amount (${formData.amount})`,
      );
      return;
    }

    try {
      setLoading(true);
      await transferService.createTillTransfer({
        transfer_type: formData.transfer_type,
        source_type: sourceType,
        source_id: formData.source_id,
        destination_type: destinationType,
        destination_id: formData.destination_id,
        amount: formData.amount,
        denomination_breakdown: backendBreakdown,
        notes: formData.notes || undefined,
      });
      toast.success("Transfer request created");
      onSuccess();
    } catch (error: unknown) {
      const maybeAxiosError = error as {
        response?: { data?: { message?: unknown } };
      };
      const message = maybeAxiosError?.response?.data?.message;
      toast.error(
        (typeof message === "string" && message) || "Failed to create transfer",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Transfer</DialogTitle>
        <DialogDescription>
          Move cash between tills and vaults (creates a pending request).
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="transfer_type">Transfer Type</Label>
          <Select
            value={formData.transfer_type}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                transfer_type: value as TransferFormState["transfer_type"],
                source_id: "",
                destination_id: "",
              }))
            }
          >
            <SelectTrigger id="transfer_type">
              <SelectValue placeholder="Select transfer type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="till_to_vault">Till → Vault</SelectItem>
              <SelectItem value="vault_to_till">Vault → Till</SelectItem>
              <SelectItem value="till_to_till">Till → Till</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="transfer_source">Source</Label>
          <Select
            value={formData.source_id}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, source_id: value }))
            }
          >
            <SelectTrigger id="transfer_source">
              <SelectValue
                placeholder={
                  loading
                    ? "Loading..."
                    : `Select ${sourceType === "till" ? "till" : "vault"}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((item) => {
                if (sourceType === "till") {
                  const till = item as Till;
                  return (
                    <SelectItem key={till.till_id} value={till.till_id}>
                      Window #{till.window_number} ({till.till_id})
                    </SelectItem>
                  );
                }
                const vault = item as VaultType;
                const vaultId = vault.vault_id || vault.id || "";
                const vaultName =
                  vault.vault_name || vault.vault_number || vaultId;
                const vaultNgn = vault.balances?.NGN;
                const available =
                  vaultNgn?.available_balance ?? vault.available_balance ?? 0;
                return (
                  <SelectItem key={vaultId} value={vaultId}>
                    {vaultName} ({vaultId}) • {vault.status} • Avail ₦
                    {available.toLocaleString()}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="transfer_destination">Destination</Label>
          <Select
            value={formData.destination_id}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, destination_id: value }))
            }
          >
            <SelectTrigger id="transfer_destination">
              <SelectValue
                placeholder={
                  loading
                    ? "Loading..."
                    : `Select ${destinationType === "till" ? "till" : "vault"}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              {destinationOptions.map((item) => {
                if (destinationType === "till") {
                  const till = item as Till;
                  return (
                    <SelectItem key={till.till_id} value={till.till_id}>
                      Window #{till.window_number} ({till.till_id})
                    </SelectItem>
                  );
                }
                const vault = item as VaultType;
                const vaultId = vault.vault_id || vault.id || "";
                const vaultName =
                  vault.vault_name || vault.vault_number || vaultId;
                const vaultNgn = vault.balances?.NGN;
                const available =
                  vaultNgn?.available_balance ?? vault.available_balance ?? 0;
                return (
                  <SelectItem key={vaultId} value={vaultId}>
                    {vaultName} ({vaultId}) • {vault.status} • Avail ₦
                    {available.toLocaleString()}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="transfer_amount">Amount (₦)</Label>
          <Input
            id="transfer_amount"
            type="number"
            value={formData.amount}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                amount: Number(e.target.value) || 0,
              }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label>Denomination Breakdown</Label>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(formData.denomination_breakdown).map((denom) => (
              <div key={denom} className="flex flex-col items-center">
                <span className="text-xs font-medium">
                  ₦{denom.replace("n", "")}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={
                    formData.denomination_breakdown[
                      denom as keyof typeof formData.denomination_breakdown
                    ]
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      denomination_breakdown: {
                        ...prev.denomination_breakdown,
                        [denom]: parseInt(e.target.value, 10) || 0,
                      },
                    }))
                  }
                  className="w-16"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="transfer_notes">Notes (optional)</Label>
          <Input
            id="transfer_notes"
            value={formData.notes || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          Create Transfer
        </Button>
      </DialogFooter>
    </>
  );
}

// Transactions Tab Component
function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ListTransactionsParams>({});

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await transactionService.listTransactions(filter);
      setTransactions(response.data);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  if (loading) {
    return <div className="text-center py-8">Loading transactions...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Transactions</h2>
        <p className="text-gray-500">Monitor all teller transactions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select
          value={filter.transaction_type || "all"}
          onValueChange={(value) =>
            setFilter({
              ...filter,
              transaction_type: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger className="w-50">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="cash_deposit">Cash Deposit</SelectItem>
            <SelectItem value="cash_withdrawal">Cash Withdrawal</SelectItem>
            <SelectItem value="check_deposit">Check Deposit</SelectItem>
            <SelectItem value="check_cashing">Check Cashing</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filter.status || "all"}
          onValueChange={(value) =>
            setFilter({
              ...filter,
              status: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger className="w-50">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {transaction.reference_number}
                  </TableCell>
                  <TableCell>
                    {transaction.transaction_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>{transaction.account_number}</TableCell>
                  <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        transaction.status === "completed"
                          ? "default"
                          : transaction.status === "pending"
                            ? "outline"
                            : transaction.status === "approved"
                              ? "secondary"
                              : "destructive"
                      }
                    >
                      {transaction.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Queue Tab Component
// Reports Tab Component
function ReportsTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-gray-500">CTR and End-of-Day reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CTR Reports</CardTitle>
            <CardDescription>Currency Transaction Reports</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              CTR reports management coming soon...
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>End-of-Day Reports</CardTitle>
            <CardDescription>Daily reconciliation reports</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              EOD reports management coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Dialog Components
function CreateTellerDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: RegisterTellerRequest) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<RegisterTellerRequest>({
    user_id: "",
    employee_number: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    daily_transaction_limit: 1000000,
    single_transaction_limit: 500000,
  });
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  useEffect(() => {
    import("@/services/admin").then(({ getAdmins }) => {
      getAdmins()
        .then(setAdmins)
        .catch(() => setAdmins([]));
    });
  }, []);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Register New Teller</DialogTitle>
        <DialogDescription>
          Enter teller information to create a new account
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="admin_select">Admin (Assign to Employee)</Label>
          <Input
            id="admin_search"
            placeholder="Search admin by name or email"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            className="mb-2"
          />
          <Select
            value={formData.employee_number}
            onValueChange={(val) => {
              const selected = admins.find((a) => a.keycloak_id === val);
              setFormData({
                ...formData,
                employee_number: val,
                user_id: val,
                first_name: selected?.first_name || "",
                last_name: selected?.last_name || "",
                email: selected?.email || "",
                phone: selected?.phone || "",
              });
            }}
          >
            <SelectTrigger id="admin_select">
              <SelectValue placeholder="Select admin..." />
            </SelectTrigger>
            <SelectContent>
              {admins
                .filter(
                  (a) =>
                    !adminSearch ||
                    a.first_name
                      ?.toLowerCase()
                      .includes(adminSearch.toLowerCase()) ||
                    a.last_name
                      ?.toLowerCase()
                      .includes(adminSearch.toLowerCase()) ||
                    a.email?.toLowerCase().includes(adminSearch.toLowerCase()),
                )
                .map((a) => (
                  <SelectItem key={a.keycloak_id} value={a.keycloak_id}>
                    {a.first_name} {a.last_name} ({a.email})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="first_name">First Name</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) =>
              setFormData({ ...formData, first_name: e.target.value })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="last_name">Last Name</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) =>
              setFormData({ ...formData, last_name: e.target.value })
            }
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
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(formData)}>Register Teller</Button>
      </DialogFooter>
    </>
  );
}

function AssignTellerDialog({
  teller,
  onSubmit,
  onCancel,
}: {
  teller: Teller | null;
  onSubmit: (data: UpdateTellerAssignmentRequest) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<UpdateTellerAssignmentRequest>({
    window_number: teller?.window_number ? String(teller.window_number) : undefined,
    assigned_till_id: teller?.assigned_till_id,
  });

  if (!teller) return null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Assign Teller</DialogTitle>
        <DialogDescription>
          Assign window and till to {teller.first_name} {teller.last_name}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="window_number">Window Number</Label>
          <Input
            id="window_number"
            value={formData.window_number || ""}
            onChange={(e) =>
              setFormData({ ...formData, window_number: e.target.value })
            }
            placeholder="e.g., Window 1"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="assigned_till_id">Till ID</Label>
          <Input
            id="assigned_till_id"
            value={formData.assigned_till_id || ""}
            onChange={(e) =>
              setFormData({ ...formData, assigned_till_id: e.target.value })
            }
            placeholder="Till ID"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(formData)}>Assign</Button>
      </DialogFooter>
    </>
  );
}

function CreateTillDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: CreateTillRequest) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateTillRequest>({
    window_number: 1,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create New Till</DialogTitle>
        <DialogDescription>Set up a new cash drawer</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="window_number">Window Number</Label>
          <Input
            id="window_number"
            type="number"
            min={1}
            value={formData.window_number}
            onChange={(e) =>
              setFormData({
                ...formData,
                window_number: parseInt(e.target.value, 10),
              })
            }
            placeholder="e.g., 1"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(formData)}>Create Till</Button>
      </DialogFooter>
    </>
  );
}

function CreateVaultDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: CreateVaultRequest) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateVaultRequest>({
    vault_name: "",
    vault_number: "",
    branch_id: "",
    minimum_balance: 0,
    maximum_balance: 0,
    requires_dual_control: true,
    dual_control_required: true,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create New Vault</DialogTitle>
        <DialogDescription>Set up a new branch vault</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="vault_name">Vault Name</Label>
          <Input
            id="vault_name"
            value={formData.vault_name || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                vault_name: e.target.value,
                // Keep legacy field in sync if anything still expects it.
                vault_number: e.target.value,
              })
            }
            placeholder="e.g., Main Vault"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="branch_id">Branch ID</Label>
          <Input
            id="branch_id"
            value={formData.branch_id}
            onChange={(e) =>
              setFormData({ ...formData, branch_id: e.target.value })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="minimum_balance">Minimum Balance (₦)</Label>
          <Input
            id="minimum_balance"
            type="number"
            value={formData.minimum_balance}
            onChange={(e) =>
              setFormData({
                ...formData,
                minimum_balance: parseFloat(e.target.value),
              })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="maximum_balance">Maximum Balance (₦)</Label>
          <Input
            id="maximum_balance"
            type="number"
            value={formData.maximum_balance}
            onChange={(e) =>
              setFormData({
                ...formData,
                maximum_balance: parseFloat(e.target.value),
              })
            }
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(formData)}>Create Vault</Button>
      </DialogFooter>
    </>
  );
}
