import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  Plus,
  Play,
  RefreshCcw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
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
import { interestComputationApi, type RateConfig, type PostingRun } from "@/api/financeApi";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "2-digit" }) : "—";

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="w-3.5 h-3.5 text-green-600" />,
  failed:    <XCircle className="w-3.5 h-3.5 text-red-600" />,
  running:   <Clock className="w-3.5 h-3.5 text-yellow-600" />,
};

const ACCOUNT_TYPES = ["savings", "current", "fixed_deposit", "loan"];
const COMPOUNDING   = ["daily", "monthly", "quarterly", "annually"];
const POSTING_FREQ  = ["daily", "monthly", "quarterly"];

export default function InterestComputationWorkspace() {
  const qc = useQueryClient();
  const [showCreateRate, setShowCreateRate] = useState(false);
  const [showRunAccrual, setShowRunAccrual] = useState(false);
  const [rateForm, setRateForm] = useState<Partial<RateConfig>>({
    account_type: "savings",
    compounding: "daily",
    posting_freq: "monthly",
    is_active: true,
  });
  const [accrualDate, setAccrualDate] = useState("");

  const { data: rates, isLoading: ratesLoading, error: ratesError, refetch: refetchRates } = useQuery({
    queryKey: ["interest-computation", "rates"],
    queryFn: () => interestComputationApi.getRates(),
    retry: 1,
  });

  const { data: runs, isLoading: runsLoading, error: runsError, refetch: refetchRuns } = useQuery({
    queryKey: ["interest-computation", "runs"],
    queryFn: () => interestComputationApi.getRuns(),
    retry: 1,
  });

  const createRateMutation = useMutation({
    mutationFn: (body: Omit<RateConfig, "id" | "tenant_id" | "created_at">) =>
      interestComputationApi.createRate(body),
    onSuccess: () => {
      toast.success("Rate configuration created");
      setShowCreateRate(false);
      setRateForm({ account_type: "savings", compounding: "daily", posting_freq: "monthly", is_active: true });
      qc.invalidateQueries({ queryKey: ["interest-computation", "rates"] });
    },
    onError: () => toast.error("Failed to create rate configuration"),
  });

  const runAccrualMutation = useMutation({
    mutationFn: () =>
      interestComputationApi.runAccrual(accrualDate ? { accrual_date: accrualDate } : {}),
    onSuccess: () => {
      toast.success("Accrual run initiated");
      setShowRunAccrual(false);
      setAccrualDate("");
      qc.invalidateQueries({ queryKey: ["interest-computation", "runs"] });
    },
    onError: () => toast.error("Failed to run accrual"),
  });

  const rateList: RateConfig[] = Array.isArray(rates) ? rates : [];
  const runList: PostingRun[]  = Array.isArray(runs) ? runs : [];

  const handleCreateRate = () => {
    const { product_code, account_type, annual_rate_bps, compounding, posting_freq } = rateForm;
    if (!product_code || !account_type || !annual_rate_bps) {
      toast.error("Product code, account type and rate (bps) are required");
      return;
    }
    createRateMutation.mutate({
      product_code,
      account_type: account_type as RateConfig["account_type"],
      annual_rate_bps: Number(annual_rate_bps),
      compounding: (compounding ?? "daily") as RateConfig["compounding"],
      posting_freq: (posting_freq ?? "monthly") as RateConfig["posting_freq"],
      min_balance_kobo: Number(rateForm.min_balance_kobo ?? 0),
      is_active: rateForm.is_active ?? true,
      effective_from: rateForm.effective_from ?? new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        <PageHeader
          label="Finance & Accounting"
          title="Interest Computation"
          description="Rate configurations, daily accrual runs and posting schedules — /interest/api/interest/*"
          icon={<Calculator className="w-8 h-8" />}
          action={{ label: "Run Accrual", onClick: () => setShowRunAccrual(true) }}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Rate Configs</span>
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{rateList.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Active rate schedules</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Accrual Runs</span>
                <Play className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{runList.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total posting runs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Last Run</span>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">
                {runList.length > 0 ? fmtDate(runList[0].run_date) : "Never"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {runList[0]?.status ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="rates" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList>
              <TabsTrigger value="rates">Rate Configurations</TabsTrigger>
              <TabsTrigger value="runs">Accrual Runs</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { refetchRates(); refetchRuns(); }}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreateRate(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Rate
              </Button>
              <Button size="sm" onClick={() => setShowRunAccrual(true)}>
                <Play className="w-4 h-4 mr-2" /> Run Accrual
              </Button>
            </div>
          </div>

          <TabsContent value="rates">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interest Rate Schedules</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ratesError ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <AlertCircle className="w-8 h-8" />
                    <p className="font-medium">Failed to load rate configurations</p>
                    <p className="text-xs">GET /interest/api/interest/rates</p>
                    <Button variant="outline" size="sm" onClick={() => refetchRates()}>Retry</Button>
                  </div>
                ) : ratesLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : rateList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <Calculator className="w-8 h-8" />
                    <p className="font-medium">No rate configurations</p>
                    <p className="text-sm">Add interest rate schedules for your products</p>
                    <Button size="sm" onClick={() => setShowCreateRate(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Add Rate Config
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Code</TableHead>
                          <TableHead>Account Type</TableHead>
                          <TableHead className="text-right">Rate (bps)</TableHead>
                          <TableHead className="text-right">Rate (%)</TableHead>
                          <TableHead>Compounding</TableHead>
                          <TableHead>Posting Freq</TableHead>
                          <TableHead>Effective From</TableHead>
                          <TableHead>Active</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rateList.map((rate) => (
                          <TableRow key={rate.id}>
                            <TableCell className="font-mono font-semibold text-sm">{rate.product_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{rate.account_type}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{rate.annual_rate_bps}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {(rate.annual_rate_bps / 100).toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-sm capitalize">{rate.compounding}</TableCell>
                            <TableCell className="text-sm capitalize">{rate.posting_freq}</TableCell>
                            <TableCell className="text-sm">{fmtDate(rate.effective_from)}</TableCell>
                            <TableCell>
                              <Badge variant={rate.is_active ? "default" : "secondary"}>
                                {rate.is_active ? "Active" : "Inactive"}
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

          <TabsContent value="runs">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Posting Runs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {runsError ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <AlertCircle className="w-8 h-8" />
                    <p className="font-medium">Failed to load accrual runs</p>
                    <p className="text-xs">GET /interest/api/interest/runs</p>
                    <Button variant="outline" size="sm" onClick={() => refetchRuns()}>Retry</Button>
                  </div>
                ) : runsLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : runList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <Play className="w-8 h-8" />
                    <p className="font-medium">No accrual runs yet</p>
                    <p className="text-sm">Trigger a run to post interest to customer accounts</p>
                    <Button size="sm" onClick={() => setShowRunAccrual(true)}>
                      <Play className="w-4 h-4 mr-2" /> Run Accrual
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Run ID</TableHead>
                          <TableHead>Run Date</TableHead>
                          <TableHead className="text-right">Accounts</TableHead>
                          <TableHead className="text-right">Total Posted</TableHead>
                          <TableHead>Triggered By</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Completed</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runList.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="font-mono text-sm">{run.id}</TableCell>
                            <TableCell className="text-sm">{fmtDate(run.run_date)}</TableCell>
                            <TableCell className="text-right">{run.accounts_processed.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {fmt(run.total_posted_kobo / 100)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{run.triggered_by}</TableCell>
                            <TableCell className="text-sm">{fmtDate(run.started_at)}</TableCell>
                            <TableCell className="text-sm">
                              {run.completed_at ? fmtDate(run.completed_at) : "—"}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                                {STATUS_ICON[run.status]}
                                <span className="capitalize">{run.status}</span>
                              </span>
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

      {/* Create Rate Config Dialog */}
      <Dialog open={showCreateRate} onOpenChange={setShowCreateRate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Rate Configuration</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Product Code *</Label>
                <Input placeholder="e.g. SAVINGS_BASIC" value={rateForm.product_code ?? ""}
                  onChange={(e) => setRateForm((f) => ({ ...f, product_code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Account Type *</Label>
                <Select value={rateForm.account_type ?? "savings"} onValueChange={(v) => setRateForm((f) => ({ ...f, account_type: v as RateConfig["account_type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Annual Rate (basis points) *</Label>
                <Input type="number" placeholder="e.g. 450 = 4.5%" min={0} value={rateForm.annual_rate_bps ?? ""}
                  onChange={(e) => setRateForm((f) => ({ ...f, annual_rate_bps: parseInt(e.target.value) }))} />
                {rateForm.annual_rate_bps ? (
                  <p className="text-xs text-muted-foreground">= {(rateForm.annual_rate_bps / 100).toFixed(2)}%</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Min Balance (Kobo)</Label>
                <Input type="number" placeholder="0" min={0} value={rateForm.min_balance_kobo ?? ""}
                  onChange={(e) => setRateForm((f) => ({ ...f, min_balance_kobo: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Compounding</Label>
                <Select value={rateForm.compounding ?? "daily"} onValueChange={(v) => setRateForm((f) => ({ ...f, compounding: v as RateConfig["compounding"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPOUNDING.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Posting Frequency</Label>
                <Select value={rateForm.posting_freq ?? "monthly"} onValueChange={(v) => setRateForm((f) => ({ ...f, posting_freq: v as RateConfig["posting_freq"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSTING_FREQ.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Effective From</Label>
              <Input type="date" value={rateForm.effective_from ?? ""}
                onChange={(e) => setRateForm((f) => ({ ...f, effective_from: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateRate(false)}>Cancel</Button>
              <Button className="flex-1" disabled={createRateMutation.isPending} onClick={handleCreateRate}>
                {createRateMutation.isPending ? "Creating…" : "Create Rate Config"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Run Accrual Dialog */}
      <Dialog open={showRunAccrual} onOpenChange={setShowRunAccrual}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Run Accrual Batch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Triggers the interest computation engine to calculate and post daily interest accruals.
              Defaults to yesterday if no date is specified.
            </p>
            <div className="space-y-1.5">
              <Label>Accrual Date (optional)</Label>
              <Input type="date" value={accrualDate} onChange={(e) => setAccrualDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Leave blank to use yesterday</p>
            </div>
            <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Endpoint</p>
              <p className="font-mono">POST /interest/api/interest/accrue</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowRunAccrual(false)}>Cancel</Button>
              <Button className="flex-1" disabled={runAccrualMutation.isPending} onClick={() => runAccrualMutation.mutate()}>
                <Play className="w-4 h-4 mr-2" />
                {runAccrualMutation.isPending ? "Running…" : "Run Accrual"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
