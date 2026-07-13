import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  RefreshCcw,
  Plus,
  FileBarChart,
  AlertCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Scale,
  Download,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  glApi,
  type GLAccount,
  type PostJournalRequest,
  type PeriodCloseRequest,
} from "@/api/financeApi";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "2-digit" }) : "—";

const CATEGORY_COLORS: Record<string, string> = {
  asset:     "bg-blue-100 text-blue-800",
  liability: "bg-orange-100 text-orange-800",
  equity:    "bg-purple-100 text-purple-800",
  revenue:   "bg-green-100 text-green-800",
  expense:   "bg-red-100 text-red-800",
};

export default function GLAccountsWorkspace() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [showPeriodDialog, setShowPeriodDialog] = useState(false);
  const [showEFASSDialog, setShowEFASSDialog] = useState(false);
  const [journalForm, setJournalForm] = useState<Partial<PostJournalRequest>>({ type: "debit", currency: "NGN" });
  const [periodForm, setPeriodForm] = useState<Partial<PeriodCloseRequest>>({});
  const [efassPeriod, setEfassPeriod] = useState("2026-04");
  const [lastEFASS, setLastEFASS] = useState<Record<string, unknown> | null>(null);

  const { data: accountsData, isLoading: accountsLoading, error: accountsError, refetch } = useQuery({
    queryKey: ["gl", "accounts", categoryFilter],
    queryFn: () =>
      glApi.getAccounts(categoryFilter !== "all" ? { category: categoryFilter } : undefined),
    retry: 1,
  });

  const { data: trialBalanceData, isLoading: tbLoading } = useQuery({
    queryKey: ["gl", "trial-balance"],
    queryFn: () => glApi.getTrialBalance(),
    retry: 1,
  });

  const journalMutation = useMutation({
    mutationFn: (body: PostJournalRequest) => glApi.postJournal(body),
    onSuccess: () => {
      toast.success("Journal entry posted successfully");
      setShowJournalDialog(false);
      setJournalForm({ type: "debit", currency: "NGN" });
      qc.invalidateQueries({ queryKey: ["gl"] });
    },
    onError: () => toast.error("Failed to post journal entry"),
  });

  const periodMutation = useMutation({
    mutationFn: (body: PeriodCloseRequest) => glApi.closePeriod(body),
    onSuccess: (data) => {
      const d = data as Record<string, unknown>;
      toast.success(`Period closed — ${d?.accountsClosed ?? 0} accounts processed`);
      setShowPeriodDialog(false);
      setPeriodForm({});
      qc.invalidateQueries({ queryKey: ["gl"] });
    },
    onError: () => toast.error("Failed to close period"),
  });

  const efassMutation = useMutation({
    mutationFn: () => glApi.generateEFASS({ period: efassPeriod }),
    onSuccess: (data) => {
      setLastEFASS(data as unknown as Record<string, unknown>);
      toast.success("EFASS report generated");
    },
    onError: () => toast.error("Failed to generate EFASS report"),
  });

  const accounts: GLAccount[] = accountsData?.items ?? [];
  const trialBalance: Array<Record<string, unknown>> =
    Array.isArray((trialBalanceData as { items?: unknown[] } | null)?.items)
      ? ((trialBalanceData as unknown as { items: Array<Record<string, unknown>> }).items)
      : Array.isArray(trialBalanceData)
        ? (trialBalanceData as Array<Record<string, unknown>>)
        : [];

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.glAccountCode.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  });

  const totalDebits  = accounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const totalCredits = accounts.filter((a) => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netPosition  = totalDebits - totalCredits;

  const handleJournalSubmit = () => {
    const { accountId, glAccountCode, type, amount, currency, narration, transactionRef } = journalForm;
    if (!accountId || !glAccountCode || !type || !amount || !currency || !narration || !transactionRef) {
      toast.error("All fields are required");
      return;
    }
    journalMutation.mutate({
      tenantId: localStorage.getItem("tenant_id") ?? "default",
      accountId,
      glAccountCode,
      type: type as "debit" | "credit",
      amount: Number(amount),
      currency,
      narration,
      transactionRef,
    });
  };

  const handlePeriodSubmit = () => {
    const { periodStart, periodEnd } = periodForm;
    if (!periodStart || !periodEnd) { toast.error("Period start and end are required"); return; }
    periodMutation.mutate({
      tenantId: localStorage.getItem("tenant_id") ?? "default",
      periodStart,
      periodEnd,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        <PageHeader
          label="Finance & Accounting"
          title="General Ledger"
          description="Chart of accounts, journal entries, trial balance and EFASS regulatory reporting — /gl-engine/v1/gl/*"
          icon={<BookOpen className="w-8 h-8" />}
          action={{ label: "Post Journal Entry", onClick: () => setShowJournalDialog(true) }}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {accountsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))
            : (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">GL Accounts</span>
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold">{accounts.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Total Debits</span>
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-xl font-bold text-green-700">{fmt(totalDebits)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Debit balances</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Total Credits</span>
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-xl font-bold text-orange-700">{fmt(totalCredits)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Credit balances</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Net Position</span>
                      <Scale className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className={`text-xl font-bold ${netPosition >= 0 ? "text-green-700" : "text-destructive"}`}>
                      {fmt(Math.abs(netPosition))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{netPosition >= 0 ? "Net debit" : "Net credit"}</p>
                  </CardContent>
                </Card>
              </>
            )}
        </div>

        <Tabs defaultValue="accounts" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList>
              <TabsTrigger value="accounts">GL Accounts</TabsTrigger>
              <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPeriodDialog(true)}>
                <Calendar className="w-4 h-4 mr-2" /> Close Period
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEFASSDialog(true)}>
                <FileBarChart className="w-4 h-4 mr-2" /> EFASS Report
              </Button>
              <Button size="sm" onClick={() => setShowJournalDialog(true)}>
                <Plus className="w-4 h-4 mr-2" /> Post Journal
              </Button>
            </div>
          </div>

          <TabsContent value="accounts">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <Input
                    placeholder="Search by code, name or category…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                  />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {accountsError ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <AlertCircle className="w-8 h-8" />
                    <p className="font-medium">Failed to load GL accounts</p>
                    <p className="text-xs text-muted-foreground">GET /gl-engine/v1/gl/accounts</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
                  </div>
                ) : accountsLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <BookOpen className="w-8 h-8" />
                    <p className="font-medium">No GL accounts found</p>
                    <p className="text-sm">Accounts will appear once provisioned in the system</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>GL Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Subcategory</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Control</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((acc) => (
                          <TableRow key={acc.glAccountCode}>
                            <TableCell className="font-mono font-semibold text-sm">{acc.glAccountCode}</TableCell>
                            <TableCell className="font-medium">{acc.name}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[acc.category] ?? "bg-muted text-muted-foreground"}`}>
                                {acc.category}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{acc.subcategory}</TableCell>
                            <TableCell><Badge variant="outline">{acc.currency}</Badge></TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              <span className={acc.balance >= 0 ? "text-green-700" : "text-destructive"}>
                                {fmt(acc.balance)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={acc.status === "active" ? "default" : "secondary"}>{acc.status}</Badge>
                            </TableCell>
                            <TableCell>
                              {acc.isControlAccount ? (
                                <Badge variant="outline" className="text-xs">Control</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trial-balance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5" /> Trial Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {tbLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : trialBalance.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <Scale className="w-8 h-8" />
                    <p className="font-medium">No trial balance entries</p>
                    <p className="text-sm">Close an accounting period to generate trial balance entries</p>
                    <Button size="sm" variant="outline" onClick={() => setShowPeriodDialog(true)}>
                      Close Period
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>GL Code</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Opening</TableHead>
                          <TableHead className="text-right">Debits</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="text-right">Closing</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trialBalance.map((tb, i) => (
                          <TableRow key={String(tb.trialBalanceId ?? i)}>
                            <TableCell className="font-mono">{String(tb.glAccountCode ?? "")}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {fmtDate(String(tb.periodStart ?? ""))} – {fmtDate(String(tb.periodEnd ?? ""))}
                            </TableCell>
                            <TableCell className="text-right font-mono">{fmt(Number(tb.openingBalance ?? 0))}</TableCell>
                            <TableCell className="text-right font-mono text-green-700">{fmt(Number(tb.totalDebits ?? 0))}</TableCell>
                            <TableCell className="text-right font-mono text-orange-700">{fmt(Number(tb.totalCredits ?? 0))}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{fmt(Number(tb.closingBalance ?? 0))}</TableCell>
                            <TableCell>
                              <Badge variant={String(tb.status) === "posted" ? "default" : "secondary"}>
                                {String(tb.status ?? "draft")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Post Journal Entry Dialog */}
      <Dialog open={showJournalDialog} onOpenChange={setShowJournalDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Post Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>GL Account Code *</Label>
                <Input placeholder="e.g. 1100" value={journalForm.glAccountCode ?? ""}
                  onChange={(e) => setJournalForm((f) => ({ ...f, glAccountCode: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Account ID *</Label>
                <Input placeholder="e.g. ACC-001" value={journalForm.accountId ?? ""}
                  onChange={(e) => setJournalForm((f) => ({ ...f, accountId: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Entry Type *</Label>
                <Select value={journalForm.type ?? "debit"} onValueChange={(v) => setJournalForm((f) => ({ ...f, type: v as "debit" | "credit" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={journalForm.currency ?? "NGN"} onValueChange={(v) => setJournalForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["NGN", "USD", "GBP", "EUR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input type="number" placeholder="0.00" min={0} value={journalForm.amount ?? ""}
                onChange={(e) => setJournalForm((f) => ({ ...f, amount: parseFloat(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Transaction Reference *</Label>
              <Input placeholder="e.g. TXN-2026-001" value={journalForm.transactionRef ?? ""}
                onChange={(e) => setJournalForm((f) => ({ ...f, transactionRef: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Narration *</Label>
              <Input placeholder="Describe the transaction" value={journalForm.narration ?? ""}
                onChange={(e) => setJournalForm((f) => ({ ...f, narration: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowJournalDialog(false)}>Cancel</Button>
              <Button className="flex-1" disabled={journalMutation.isPending} onClick={handleJournalSubmit}>
                {journalMutation.isPending ? "Posting…" : "Post Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Period Close Dialog */}
      <Dialog open={showPeriodDialog} onOpenChange={setShowPeriodDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Close Accounting Period</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aggregates journal entries into trial balance and publishes a period-close event.
            </p>
            <div className="space-y-1.5">
              <Label>Period Start *</Label>
              <Input type="date" value={periodForm.periodStart ?? ""}
                onChange={(e) => setPeriodForm((f) => ({ ...f, periodStart: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Period End *</Label>
              <Input type="date" value={periodForm.periodEnd ?? ""}
                onChange={(e) => setPeriodForm((f) => ({ ...f, periodEnd: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPeriodDialog(false)}>Cancel</Button>
              <Button className="flex-1" disabled={periodMutation.isPending} onClick={handlePeriodSubmit}>
                {periodMutation.isPending ? "Closing…" : "Close Period"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EFASS Report Dialog */}
      <Dialog open={showEFASSDialog} onOpenChange={setShowEFASSDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>EFASS Regulatory Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 flex-1">
                <Label>Reporting Period (YYYY-MM)</Label>
                <Input placeholder="e.g. 2026-04" value={efassPeriod} onChange={(e) => setEfassPeriod(e.target.value)} />
              </div>
              <Button disabled={efassMutation.isPending} onClick={() => efassMutation.mutate()}>
                <Download className="w-4 h-4 mr-2" />
                {efassMutation.isPending ? "Generating…" : "Generate"}
              </Button>
            </div>

            {lastEFASS && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Report ID: {String(lastEFASS.reportId ?? "")}</span>
                  <Badge>Generated</Badge>
                </div>
                {!!lastEFASS.totals && (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {Object.entries(lastEFASS.totals as Record<string, number>).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-muted-foreground text-xs capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                        <p className="font-semibold font-mono text-sm">
                          {typeof v === "number" && v > 1000 ? fmt(v) : Number(v).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => setShowEFASSDialog(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
