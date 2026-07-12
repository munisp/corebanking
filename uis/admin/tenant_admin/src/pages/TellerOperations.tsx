import {
  queueService,
  tellerService,
  tillService,
  transactionService,
} from "@/api/tellerApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  CashDepositRequest,
  CashWithdrawalRequest,
  CheckDepositRequest,
  DenominationBreakdown,
  QueueTicket,
  Teller,
  Till,
  Transaction,
} from "@/types/teller";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  DollarSign,
  FileText,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";

export default function TellerOperations() {
  const [teller, setTeller] = useState<Teller | null>(null);
  const [till, setTill] = useState<Till | null>(null);
  const [currentTicket, setCurrentTicket] = useState<QueueTicket | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("session");

  const loadQueueData = useCallback(async () => {
    try {
      await queueService.getQueueStats();
    } catch (error) {
      console.error("Error loading queue data:", error);
    }
  }, []);

  const loadTellerSession = useCallback(async () => {
    try {
      setLoading(true);
      // Derive current user identity from the same auth storage used by Login.
      const authUserStr = localStorage.getItem("auth_user");
      const authUser = authUserStr
        ? (JSON.parse(authUserStr) as {
            id?: string;
            email?: string;
            keycloak_id?: string;
          })
        : null;

      const keycloakId =
        localStorage.getItem("keycloak_id") || authUser?.keycloak_id || "";
      const userId = keycloakId || authUser?.id || "";
      const userEmail = authUser?.email || "";

      if (!userId && !userEmail) {
        toast.error("User not authenticated");
        return;
      }

      // Get teller info
      const tellersRes = await tellerService.listTellers();
      const candidateUserIds = [userId, keycloakId].filter(Boolean);
      const currentTeller =
        tellersRes.data.find((t) => candidateUserIds.includes(t.user_id)) ||
        (userEmail
          ? tellersRes.data.find(
              (t) => (t.email || "").toLowerCase() === userEmail.toLowerCase(),
            )
          : undefined);

      if (!currentTeller) {
        toast.error("Teller account not found");
        return;
      }

      // Some list endpoints omit window_number; fall back to teller detail and/or till.
      let resolvedTeller = currentTeller;
      if (!resolvedTeller.window_number) {
        try {
          const detailed = await tellerService.getTeller(resolvedTeller.id);
          if (detailed.window_number) {
            resolvedTeller = {
              ...resolvedTeller,
              window_number: detailed.window_number,
            };
          }
        } catch (error) {
          console.warn("Could not load teller details:", error);
        }
      }

      setTeller(resolvedTeller);

      // Get till info if assigned
      if (currentTeller.assigned_till_id) {
        const tillRes = await tillService.getTill(
          currentTeller.assigned_till_id,
        );
        setTill(tillRes);

        // Persist branch context for teller-service calls.
        // The backend requires X-Branch-ID (or branch_id query param) for many endpoints.
        if (tillRes?.branch_id) {
          localStorage.setItem("branch_id", tillRes.branch_id);
        }

        // If teller still has no window number, derive from the till.
        if (
          !resolvedTeller.window_number &&
          tillRes?.window_number !== undefined
        ) {
          setTeller((prev) =>
            prev
              ? { ...prev, window_number: String(tillRes.window_number) }
              : prev,
          );
        }
      }

      // Load recent transactions
      const transactionsRes = await transactionService.listTransactions({
        teller_id: resolvedTeller.id,
        limit: 10,
      });
      setRecentTransactions(transactionsRes.data);

      await loadQueueData();
    } catch (error) {
      console.error("Error loading teller session:", error);
      toast.error("Failed to load teller session");
    } finally {
      setLoading(false);
    }
  }, [loadQueueData]);

  useEffect(() => {
    loadTellerSession();
    const interval = setInterval(loadQueueData, 30000); // Refresh queue every 30s
    return () => clearInterval(interval);
  }, [loadQueueData, loadTellerSession]);

  const handleCompleteService = async () => {
    if (!currentTicket) return;

    try {
      await queueService.completeService(currentTicket.id);
      toast.success("Service completed");
      setCurrentTicket(null);
      loadQueueData();
    } catch (error: unknown) {
      const maybeAxiosError = error as {
        response?: { data?: { message?: unknown } };
      };
      const message = maybeAxiosError?.response?.data?.message;
      toast.error(
        (typeof message === "string" && message) ||
          "Failed to complete service",
      );
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading teller station...</div>;
  }

  if (!teller) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Teller Account Not Found</h2>
        <p className="text-gray-500">
          Please contact your administrator to set up a teller account.
        </p>
      </div>
    );
  }

  const tillNgn = till?.balances?.NGN;
  const tillCurrentBalance = tillNgn?.current_balance ?? 0;
  const windowNumber =
    teller.window_number || (till ? String(till.window_number) : "");

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Teller Station"
          title="Teller Operations"
          description={`${teller.first_name} ${teller.last_name} • Window ${windowNumber || "Not Assigned"}`}
          icon={<User className="w-8 h-8" />}
        />
      </div>

      <div className="container p-6 space-y-6">

      {/* Current Customer */}
      {currentTicket && (
        <Card className="border-blue-500 border-2">
          <CardHeader>
            <CardTitle>Currently Serving</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold">
                  {currentTicket.customer_name}
                </p>
                <p className="text-sm text-gray-500">
                  Ticket #{currentTicket.ticket_number} •{" "}
                  {currentTicket.service_type}
                </p>
              </div>
              <Button onClick={handleCompleteService}>Complete Service</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Next Button */}
      {/* {!currentTicket && windowNumber && (
        <Button size="lg" className="w-full" onClick={handleCallNext}>
          <Bell className="mr-2 h-5 w-5" />
          Call Next Customer
        </Button>
      )} */}

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="session">Session</TabsTrigger>
          <TabsTrigger value="deposit">Cash Deposit</TabsTrigger>
          <TabsTrigger value="withdrawal">Cash Withdrawal</TabsTrigger>
          <TabsTrigger value="check">Check Deposit</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="session">
          <SessionTab
            teller={teller}
            till={till}
            recentTransactions={recentTransactions}
          />
        </TabsContent>

        <TabsContent value="deposit">
          <CashDepositTab tellerId={teller.id} onSuccess={loadTellerSession} />
        </TabsContent>

        <TabsContent value="withdrawal">
          <CashWithdrawalTab
            tellerId={teller.id}
            tillBalance={tillCurrentBalance}
            onSuccess={loadTellerSession}
          />
        </TabsContent>

        <TabsContent value="check">
          <CheckDepositTab tellerId={teller.id} onSuccess={loadTellerSession} />
        </TabsContent>

        <TabsContent value="history">
          <TransactionHistoryTab transactions={recentTransactions} />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

// Session Tab Component
function SessionTab({
  teller,
  till,
  recentTransactions,
}: {
  teller: Teller;
  till: Till | null;
  recentTransactions: Transaction[];
}) {
  const tillNgn = till?.balances?.NGN;
  const tillCurrentBalance = tillNgn?.current_balance ?? 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const todayTransactions = recentTransactions.filter((t) => {
    const today = new Date().toDateString();
    const transDate = new Date(t.created_at).toDateString();
    return today === transDate;
  });

  const todayDeposits = todayTransactions
    .filter((t) => t.transaction_type === "cash_deposit")
    .reduce((sum, t) => sum + t.amount, 0);

  const todayWithdrawals = todayTransactions
    .filter((t) => t.transaction_type === "cash_withdrawal")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Window Number</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teller.window_number || "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Till Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(tillCurrentBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {till?.till_id || "No till assigned"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Deposits
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(todayDeposits)}
            </div>
            <p className="text-xs text-muted-foreground">
              {
                todayTransactions.filter(
                  (t) => t.transaction_type === "cash_deposit",
                ).length
              }{" "}
              transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Withdrawals
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(todayWithdrawals)}
            </div>
            <p className="text-xs text-muted-foreground">
              {
                todayTransactions.filter(
                  (t) => t.transaction_type === "cash_withdrawal",
                ).length
              }{" "}
              transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Single Transaction Limit</p>
              <p className="text-xl font-bold">
                {formatCurrency(teller.single_transaction_limit)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Daily Transaction Limit</p>
              <p className="text-xl font-bold">
                {formatCurrency(teller.daily_transaction_limit)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {till && (
        <Card>
          <CardHeader>
            <CardTitle>Till Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Opening Balance:</span>
                <span className="font-semibold">
                  {formatCurrency(tillNgn?.opening_balance ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Current Balance:</span>
                <span className="font-semibold">
                  {formatCurrency(tillCurrentBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Total Deposits:</span>
                <span className="text-green-600">
                  {formatCurrency(tillNgn?.total_deposits ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Total Withdrawals:
                </span>
                <span className="text-red-600">
                  {formatCurrency(tillNgn?.total_withdrawals ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status:</span>
                <Badge
                  variant={till.status === "open" ? "default" : "secondary"}
                >
                  {till.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Cash Deposit Tab Component
function CashDepositTab({
  tellerId,
  onSuccess,
}: {
  tellerId: string;
  onSuccess: () => void;
}) {
  const [accountNumber, setAccountNumber] = useState("");
  const [accountId, setAccountId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [denominations, setDenominations] = useState<DenominationBreakdown>({
    n1000: 0,
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
    n5: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const calculateTotal = () => {
    return (
      denominations.n1000 * 1000 +
      denominations.n500 * 500 +
      denominations.n200 * 200 +
      denominations.n100 * 100 +
      denominations.n50 * 50 +
      denominations.n20 * 20 +
      denominations.n10 * 10 +
      denominations.n5 * 5
    );
  };

  const handleSubmit = async () => {
    const total = calculateTotal();
    if (total === 0) {
      toast.error("Please enter cash denominations");
      return;
    }

    if (!accountNumber) {
      toast.error("Please enter account number");
      return;
    }

    try {
      setSubmitting(true);
      const request: CashDepositRequest = {
        teller_id: tellerId,
        customer_id: customerId || accountNumber,
        account_number: accountNumber,
        ...(accountId ? { account_id: parseInt(accountId, 10) } : {}),
        amount: total,
        denomination_breakdown: denominations,
        transaction_notes: notes,
      };

      await transactionService.cashDeposit(request);
      toast.success(`Deposit of ${formatCurrency(total)} successful`);

      // Reset form
      setAccountNumber("");
      setAccountId("");
      setCustomerId("");
      setNotes("");
      setDenominations({
        n1000: 0,
        n500: 0,
        n200: 0,
        n100: 0,
        n50: 0,
        n20: 0,
        n10: 0,
        n5: 0,
      });

      onSuccess();
    } catch (error: unknown) {
      const maybeAxiosError = error as {
        response?: { data?: { message?: unknown } };
      };
      const message = maybeAxiosError?.response?.data?.message;
      toast.error(
        (typeof message === "string" && message) || "Failed to process deposit",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Deposit</CardTitle>
        <CardDescription>Process customer cash deposit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Info */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="account_number">Account Number *</Label>
            <Input
              id="account_number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter account number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_id">Account ID (Optional)</Label>
            <Input
              id="account_id"
              type="number"
              min="1"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Enter account ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer_id">Customer ID (Optional)</Label>
            <Input
              id="customer_id"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Enter customer ID"
            />
          </div>
        </div>

        {/* Denominations */}
        <div>
          <Label className="mb-3 block">Cash Denominations</Label>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(denominations).map(([key, value]) => {
              const amount = parseInt(key.replace("n", ""));
              return (
                <div key={key} className="flex items-center gap-2">
                  <Label className="w-16">₦{amount}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) =>
                      setDenominations({
                        ...denominations,
                        [key]: parseInt(e.target.value) || 0,
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 w-24">
                    ={" "}
                    {formatCurrency(amount * (parseInt(value.toString()) || 0))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total Amount</span>
            <span className="text-2xl font-bold text-blue-600">
              {formatCurrency(calculateTotal())}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this transaction"
            rows={3}
          />
        </div>

        {/* Submit */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          <ArrowDownCircle className="mr-2 h-5 w-5" />
          {submitting ? "Processing..." : "Process Deposit"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Cash Withdrawal Tab Component
function CashWithdrawalTab({
  tellerId,
  tillBalance,
  onSuccess,
}: {
  tellerId: string;
  tillBalance: number;
  onSuccess: () => void;
}) {
  const [accountNumber, setAccountNumber] = useState("");
  const [accountId, setAccountId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const withdrawalAmount = parseFloat(amount);
    if (!withdrawalAmount || withdrawalAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!accountNumber) {
      toast.error("Please enter account number");
      return;
    }

    if (withdrawalAmount > tillBalance) {
      toast.error("Insufficient till balance");
      return;
    }

    try {
      setSubmitting(true);
      const request: CashWithdrawalRequest = {
        teller_id: tellerId,
        customer_id: customerId || accountNumber,
        account_number: accountNumber,
        account_id: accountId ? parseInt(accountId, 10) : undefined,
        amount: withdrawalAmount,
        transaction_notes: notes,
      };

      await transactionService.cashWithdrawal(request);
      toast.success(
        `Withdrawal of ${formatCurrency(withdrawalAmount)} successful`,
      );

      // Reset form
      setAccountNumber("");
      setAccountId("");
      setCustomerId("");
      setAmount("");
      setNotes("");

      onSuccess();
    } catch (error: unknown) {
      const maybeAxiosError = error as {
        response?: { data?: { message?: unknown } };
      };
      const message = maybeAxiosError?.response?.data?.message;
      toast.error(
        (typeof message === "string" && message) ||
          "Failed to process withdrawal",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Withdrawal</CardTitle>
        <CardDescription>Process customer cash withdrawal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Till Balance Warning */}
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-semibold">
                Till Balance: {formatCurrency(tillBalance)}
              </p>
              <p className="text-sm text-gray-600">
                Ensure sufficient cash before processing withdrawal
              </p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="account_number">Account Number *</Label>
            <Input
              id="account_number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter account number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_id">Account ID (Optional)</Label>
            <Input
              id="account_id"
              type="number"
              min="1"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Enter account ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer_id">Customer ID (Optional)</Label>
            <Input
              id="customer_id"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Enter customer ID"
            />
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Withdrawal Amount *</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this transaction"
            rows={3}
          />
        </div>

        {/* Submit */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          <ArrowUpCircle className="mr-2 h-5 w-5" />
          {submitting ? "Processing..." : "Process Withdrawal"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Check Deposit Tab Component
function CheckDepositTab({
  tellerId,
  onSuccess,
}: {
  tellerId: string;
  onSuccess: () => void;
}) {
  const [accountNumber, setAccountNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [drawerAccount, setDrawerAccount] = useState("");
  const [drawerName, setDrawerName] = useState("");
  const [bankName, setBankName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const depositAmount = parseFloat(amount);
    if (!depositAmount || depositAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!accountNumber || !checkNumber || !checkDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);
      const request: CheckDepositRequest = {
        teller_id: tellerId,
        customer_id: customerId || accountNumber,
        account_number: accountNumber,
        amount: depositAmount,
        check_details: {
          check_number: checkNumber,
          check_date: checkDate,
          drawer_account: drawerAccount,
          drawer_name: drawerName,
          bank_name: bankName,
          hold_period_days: 3,
          available_date: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          clearing_status: "pending",
        },
        transaction_notes: notes,
      };

      await transactionService.checkDeposit(request);
      toast.success(
        `Check deposit of ${formatCurrency(depositAmount)} successful`,
      );

      // Reset form
      setAccountNumber("");
      setCustomerId("");
      setAmount("");
      setCheckNumber("");
      setCheckDate("");
      setDrawerAccount("");
      setDrawerName("");
      setBankName("");
      setNotes("");

      onSuccess();
    } catch (error: unknown) {
      const maybeAxiosError = error as {
        response?: { data?: { message?: unknown } };
      };
      const message = maybeAxiosError?.response?.data?.message;
      toast.error(
        (typeof message === "string" && message) ||
          "Failed to process check deposit",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check Deposit</CardTitle>
        <CardDescription>Process customer check deposit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account_number">Account Number *</Label>
            <Input
              id="account_number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter account number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Check Amount *</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
          </div>
        </div>

        {/* Check Details */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="check_number">Check Number *</Label>
            <Input
              id="check_number"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Enter check number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="check_date">Check Date *</Label>
            <Input
              id="check_date"
              type="date"
              value={checkDate}
              onChange={(e) => setCheckDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="drawer_name">Drawer Name</Label>
            <Input
              id="drawer_name"
              value={drawerName}
              onChange={(e) => setDrawerName(e.target.value)}
              placeholder="Name on check"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer_account">Drawer Account</Label>
            <Input
              id="drawer_account"
              value={drawerAccount}
              onChange={(e) => setDrawerAccount(e.target.value)}
              placeholder="Drawer account number"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank_name">Bank Name</Label>
          <Input
            id="bank_name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Issuing bank name"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this transaction"
            rows={3}
          />
        </div>

        {/* Info */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold">Hold Period: 3 business days</p>
              <p className="text-sm text-gray-600">
                Funds will be available after check clearing
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          <FileText className="mr-2 h-5 w-5" />
          {submitting ? "Processing..." : "Process Check Deposit"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Transaction History Tab Component
function TransactionHistoryTab({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Your transaction history</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  {transaction.reference_number}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {transaction.transaction_type === "cash_deposit" ? (
                      <ArrowDownCircle className="h-4 w-4 text-green-500" />
                    ) : transaction.transaction_type === "cash_withdrawal" ? (
                      <ArrowUpCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-500" />
                    )}
                    {transaction.transaction_type.replace(/_/g, " ")}
                  </div>
                </TableCell>
                <TableCell>{transaction.account_number}</TableCell>
                <TableCell
                  className={
                    transaction.transaction_type === "cash_deposit"
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {formatCurrency(transaction.amount)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      transaction.status === "completed"
                        ? "default"
                        : transaction.status === "pending"
                          ? "outline"
                          : "destructive"
                    }
                  >
                    {transaction.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(transaction.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  No transactions yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
