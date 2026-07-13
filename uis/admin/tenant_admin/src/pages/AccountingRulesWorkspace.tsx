import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scale,
  Plus,
  RefreshCcw,
  AlertCircle,
  FileText,
  Database,
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
import { accountingRulesApi, type AccountingRule } from "@/api/financeApi";

export default function AccountingRulesWorkspace() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<AccountingRule>>({});

  const { data: listData, isLoading, error, refetch } = useQuery({
    queryKey: ["accounting-rules", "list", page],
    queryFn: () => accountingRulesApi.list(page, 25),
    retry: 1,
  });

  const { data: statsData } = useQuery({
    queryKey: ["accounting-rules", "stats"],
    queryFn: () => accountingRulesApi.stats(),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (body: Partial<AccountingRule>) => accountingRulesApi.create(body),
    onSuccess: () => {
      toast.success("Accounting rule created");
      setShowCreate(false);
      setForm({});
      qc.invalidateQueries({ queryKey: ["accounting-rules"] });
    },
    onError: () => toast.error("Failed to create rule"),
  });

  const rules: AccountingRule[] = listData?.items ?? [];
  const total = listData?.total ?? statsData?.total ?? 0;

  const filtered = rules.filter((r) => {
    const q = search.toLowerCase();
    return (
      String(r.id ?? "").toLowerCase().includes(q) ||
      String(r.event ?? "").toLowerCase().includes(q) ||
      String(r.debit_gl ?? "").toLowerCase().includes(q) ||
      String(r.credit_gl ?? "").toLowerCase().includes(q) ||
      String(r.product ?? "").toLowerCase().includes(q)
    );
  });

  const handleCreate = () => {
    if (!form.event) { toast.error("Event name is required"); return; }
    createMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        <PageHeader
          label="Finance & Accounting"
          title="Accounting Rules Engine"
          description="Event-driven GL posting — every banking event triggers double-entry accounting — /accounting-rules/v1/accounting-rules/*"
          icon={<Scale className="w-8 h-8" />}
          action={{ label: "New Rule", onClick: () => setShowCreate(true) }}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Total Rules</span>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground mt-1">Accounting rules defined</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Service</span>
                <Database className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">accounting-rules-rs</p>
              <p className="text-xs text-muted-foreground mt-1">Rust | Port 8209</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Data Source</span>
                <Database className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm font-semibold">{statsData?.source ?? "PostgreSQL"}</p>
              <p className="text-xs text-muted-foreground mt-1">Table: accounting_rules</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" /> Rules Registry
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search rules…"
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
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <AlertCircle className="w-8 h-8" />
                <p className="font-medium">Failed to load accounting rules</p>
                <p className="text-xs">GET /accounting-rules/v1/accounting-rules/list</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Scale className="w-8 h-8" />
                <p className="font-medium">No accounting rules defined</p>
                <p className="text-sm">Create rules to automate GL posting for banking events</p>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create First Rule
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule ID</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Debit GL</TableHead>
                        <TableHead>Credit GL</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((rule, i) => (
                        <TableRow key={String(rule.id ?? i)}>
                          <TableCell className="font-mono text-sm">{String(rule.id ?? "—")}</TableCell>
                          <TableCell className="font-medium text-sm">{String(rule.event ?? "—")}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{String(rule.product ?? "—")}</TableCell>
                          <TableCell className="font-mono text-sm text-green-700">{String(rule.debit_gl ?? "—")}</TableCell>
                          <TableCell className="font-mono text-sm text-orange-700">{String(rule.credit_gl ?? "—")}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {String(rule.description ?? "—")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={String(rule.status) === "active" ? "default" : "secondary"}>
                              {String(rule.status ?? "active")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {total > 25 && (
                  <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
                    <span>Page {page} · {total} total rules</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Rule Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Accounting Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Event Name *</Label>
                <Input placeholder="e.g. loan_disbursement" value={String(form.event ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Input placeholder="e.g. retail_loan" value={String(form.product ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Debit GL Code</Label>
                <Input placeholder="e.g. 1301" value={String(form.debit_gl ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, debit_gl: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Credit GL Code</Label>
                <Input placeholder="e.g. 2101" value={String(form.credit_gl ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, credit_gl: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Describe when this rule fires" value={String(form.description ?? "")}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1" disabled={createMutation.isPending} onClick={handleCreate}>
                {createMutation.isPending ? "Creating…" : "Create Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
