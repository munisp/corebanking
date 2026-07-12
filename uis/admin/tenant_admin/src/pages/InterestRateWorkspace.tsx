import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart as LineChartIcon,
  Plus,
  RefreshCcw,
  AlertCircle,
  TrendingUp,
  Activity,
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
import { interestRateApi, type InterestRate } from "@/api/financeApi";

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "2-digit" }) : "—";

const SOURCES = ["CBN", "FMDQ", "FRBNY", "Internal"];
const CURRENCIES = ["NGN", "USD", "GBP", "EUR"];
const ACCOUNT_TYPES = ["savings", "current", "fixed_deposit", "loan", "overdraft", "mortgage", "all"];

const SOURCE_COLORS: Record<string, string> = {
  CBN:      "bg-green-100 text-green-800",
  FMDQ:     "bg-blue-100 text-blue-800",
  FRBNY:    "bg-purple-100 text-purple-800",
  Internal: "bg-orange-100 text-orange-800",
};

export default function InterestRateWorkspace() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<InterestRate>>({
    source: "CBN",
    currency: "NGN",
    status: "active",
    account_type: "all",
  });

  const { data: listData, isLoading, error, refetch } = useQuery({
    queryKey: ["interest-rate", "rates"],
    queryFn: () => interestRateApi.getRates(),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (body: Partial<InterestRate>) => interestRateApi.createRate(body),
    onSuccess: () => {
      toast.success("Interest rate created");
      setShowCreate(false);
      setForm({ source: "CBN", currency: "NGN", status: "active", account_type: "all" });
      qc.invalidateQueries({ queryKey: ["interest-rate"] });
    },
    onError: () => toast.error("Failed to create interest rate"),
  });

  const rates: InterestRate[] = listData?.items ?? [];
  const filtered = rates.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.source.toLowerCase().includes(q) ||
      (r.account_type ?? "").toLowerCase().includes(q)
    );
  });

  const handleCreate = () => {
    if (!form.name) { toast.error("Rate name is required"); return; }
    if (form.rate == null) { toast.error("Rate (%) is required"); return; }
    createMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        <PageHeader
          label="Finance & Accounting"
          title="Interest Rates"
          description="CBN MPR tracking, base rates, spread matrices and product rate configuration — /interest-rate-engine/v1/rates/*"
          icon={<TrendingUp className="w-8 h-8" />}
          action={{ label: "Add Rate", onClick: () => setShowCreate(true) }}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Active Rates</span>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{rates.filter((r) => r.status === "active").length}</p>
              <p className="text-xs text-muted-foreground mt-1">Currently active rate schedules</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Total Rates</span>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{rates.length}</p>
              <p className="text-xs text-muted-foreground mt-1">All rate configurations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Service</span>
                <LineChartIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">interest-rate-engine-go</p>
              <p className="text-xs text-muted-foreground mt-1">Go | Port 9278</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" /> Rate Registry
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search rates…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
                </Button>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Rate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <AlertCircle className="w-8 h-8" />
                <div className="text-center">
                  <p className="font-medium">Interest Rate Engine unavailable</p>
                  <p className="text-sm mt-1">
                    The interest-rate-engine-go backend is being initialized.
                    Rate management routes will be available once the service is fully deployed.
                  </p>
                  <p className="text-xs mt-2 font-mono">GET /interest-rate-engine/v1/rates</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Retry
                </Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <TrendingUp className="w-8 h-8" />
                <p className="font-medium">No interest rates configured</p>
                <p className="text-sm">Add CBN base rates and product-specific spreads</p>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add First Rate
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rate Name</TableHead>
                      <TableHead>Account Type</TableHead>
                      <TableHead className="text-right">Rate (%)</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-medium">{rate.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rate.account_type ?? "all"}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">{Number(rate.rate).toFixed(2)}%</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_COLORS[rate.source] ?? "bg-muted text-muted-foreground"}`}>
                            {rate.source}
                          </span>
                        </TableCell>
                        <TableCell><Badge variant="outline">{rate.currency}</Badge></TableCell>
                        <TableCell className="text-sm">{fmtDate(rate.effective_from ?? "")}</TableCell>
                        <TableCell>
                          <Badge variant={rate.status === "active" ? "default" : "secondary"}>{rate.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Rate Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Interest Rate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Rate Name *</Label>
              <Input placeholder="e.g. CBN MPR – May 2026" value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rate (%) *</Label>
                <Input type="number" placeholder="e.g. 26.75" step="0.01" min={0} max={100} value={form.rate ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, rate: parseFloat(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Source *</Label>
                <Select value={form.source ?? "CBN"} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Account Type</Label>
                <Select value={form.account_type ?? "all"} onValueChange={(v) => setForm((f) => ({ ...f, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency ?? "NGN"} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Effective From</Label>
                <Input type="date" value={form.effective_from ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1" disabled={createMutation.isPending} onClick={handleCreate}>
                {createMutation.isPending ? "Creating…" : "Add Rate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
