import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  Plus,
  RefreshCcw,
  AlertCircle,
  Layers,
  Percent,
  Hash,
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
import { feeManagementApi, type FeeRule } from "@/api/financeApi";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const FEE_TYPE_ICONS: Record<string, React.ReactNode> = {
  fixed:      <Hash className="w-3.5 h-3.5" />,
  percentage: <Percent className="w-3.5 h-3.5" />,
  tiered:     <BarChart3 className="w-3.5 h-3.5" />,
};

export default function FeeManagementWorkspace() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<FeeRule>>({ fee_type: "fixed", currency: "NGN", status: "active" });

  const { data: listData, isLoading, error, refetch } = useQuery({
    queryKey: ["fee-management", "rules"],
    queryFn: () => feeManagementApi.getRules(),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (body: Partial<FeeRule>) => feeManagementApi.createRule(body),
    onSuccess: () => {
      toast.success("Fee rule created");
      setShowCreate(false);
      setForm({ fee_type: "fixed", currency: "NGN", status: "active" });
      qc.invalidateQueries({ queryKey: ["fee-management"] });
    },
    onError: () => toast.error("Failed to create fee rule"),
  });

  const rules: FeeRule[] = listData?.items ?? [];
  const filtered = rules.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.service ?? "").toLowerCase().includes(q) ||
      (r.product_code ?? "").toLowerCase().includes(q)
    );
  });

  const handleCreate = () => {
    if (!form.name) { toast.error("Fee rule name is required"); return; }
    if (!form.fee_type) { toast.error("Fee type is required"); return; }
    createMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        <PageHeader
          label="Finance & Accounting"
          title="Fee Management"
          description="Fee rules engine — fixed, percentage and tiered charge configuration — /fee-management/v1/fee-rules/*"
          icon={<CircleDollarSign className="w-8 h-8" />}
          action={{ label: "New Fee Rule", onClick: () => setShowCreate(true) }}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Fee Rules</span>
                <Layers className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{rules.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Configured fee schedules</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Active Rules</span>
                <CircleDollarSign className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-700">
                {rules.filter((r) => r.status === "active").length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Currently applied</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Service</span>
                <Hash className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">fee-management-go</p>
              <p className="text-xs text-muted-foreground mt-1">Go | Port 9268</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5" /> Fee Rules
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search fee rules…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
                </Button>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-2" /> New Rule
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <AlertCircle className="w-8 h-8" />
                <div className="text-center">
                  <p className="font-medium">Fee Management service unavailable</p>
                  <p className="text-sm mt-1">
                    The fee-management-go backend is being initialized.
                    Routes will be available once the service is fully deployed.
                  </p>
                  <p className="text-xs mt-2 font-mono">GET /fee-management/v1/fee-rules</p>
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
                <CircleDollarSign className="w-8 h-8" />
                <p className="font-medium">No fee rules configured</p>
                <p className="text-sm">Create fee rules to define charges for your products and services</p>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create First Rule
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Product / Service</TableHead>
                      <TableHead className="text-right">Amount / Rate</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono text-sm">{rule.id}</TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                            {FEE_TYPE_ICONS[rule.fee_type]}
                            {rule.fee_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rule.product_code ?? rule.service ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {rule.fee_type === "percentage"
                            ? `${rule.rate ?? 0}%`
                            : fmt(rule.amount ?? 0)}
                        </TableCell>
                        <TableCell><Badge variant="outline">{rule.currency}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rule.effective_from
                            ? new Date(rule.effective_from).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "2-digit" })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.status === "active" ? "default" : "secondary"}>
                            {rule.status}
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
      </div>

      {/* Create Fee Rule Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Fee Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fee Rule Name *</Label>
              <Input placeholder="e.g. Transfer Fee – Interbank" value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fee Type *</Label>
                <Select value={form.fee_type ?? "fixed"} onValueChange={(v) => setForm((f) => ({ ...f, fee_type: v as FeeRule["fee_type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="tiered">Tiered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency ?? "NGN"} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["NGN", "USD", "GBP", "EUR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.fee_type === "percentage" ? (
              <div className="space-y-1.5">
                <Label>Rate (%)</Label>
                <Input type="number" placeholder="e.g. 1.5" step="0.01" min={0} value={form.rate ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, rate: parseFloat(e.target.value) }))} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Fixed Amount</Label>
                <Input type="number" placeholder="e.g. 50" min={0} value={form.amount ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Product Code</Label>
                <Input placeholder="e.g. TRANSFER" value={form.product_code ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Service</Label>
                <Input placeholder="e.g. interbank_transfer" value={form.service ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Effective From</Label>
              <Input type="date" value={form.effective_from ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1" disabled={createMutation.isPending} onClick={handleCreate}>
                {createMutation.isPending ? "Creating…" : "Create Fee Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
