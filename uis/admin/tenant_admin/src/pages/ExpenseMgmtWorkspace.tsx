import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  AlertCircle,
  RefreshCcw,
  DollarSign,
  Layers,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { expenseApi, type Expense } from "@/api/financeApi";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "2-digit" }) : "—";

const STATUS_STYLES: Record<string, { cls: string; icon: React.ReactNode }> = {
  paid:     { cls: "bg-green-100 text-green-800",  icon: <CheckCircle className="w-3 h-3" /> },
  approved: { cls: "bg-blue-100 text-blue-800",    icon: <CheckCircle className="w-3 h-3" /> },
  pending:  { cls: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-3 h-3" /> },
  rejected: { cls: "bg-red-100 text-red-800",      icon: <XCircle className="w-3 h-3" /> },
};

const CATEGORY_LABELS: Record<string, string> = {
  staff_cost: "Staff Cost",
  occupancy: "Occupancy",
  technology: "Technology",
  marketing: "Marketing",
  compliance: "Compliance",
  operations: "Operations",
  travel: "Travel",
  miscellaneous: "Miscellaneous",
};

export default function ExpenseMgmtWorkspace() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const { data: listData, isLoading: listLoading, error: listError, refetch } = useQuery({
    queryKey: ["expenses", "list"],
    queryFn: () => expenseApi.list(),
    retry: 1,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["expenses", "stats"],
    queryFn: () => expenseApi.stats(),
    retry: 1,
  });

  const expenses: Expense[] = listData?.items ?? [];

  const departments = [...new Set(expenses.map((e) => e.department))];
  const categories  = [...new Set(expenses.map((e) => e.category))];

  const filtered = expenses.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      e.id.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q);
    const matchCat   = categoryFilter === "all" || e.category === categoryFilter;
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    const matchDept  = deptFilter === "all" || e.department === deptFilter;
    return matchSearch && matchCat && matchStatus && matchDept;
  });

  const paidTotal    = expenses.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const pendingTotal = expenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        <PageHeader
          label="Finance & Accounting"
          title="Expense Management"
          description="OPEX tracking, department budgets and approval workflows — /expenses/v1/expense-mgmt-go/*"
          icon={<Receipt className="w-8 h-8" />}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))
            : (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Total Expenses</span>
                      <Layers className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold">{statsData?.total_expenses ?? expenses.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">All expense records</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Total Amount</span>
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold">{fmt(statsData?.total_amount ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">All OPEX</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Paid</span>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-xl font-bold text-green-700">{fmt(paidTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Disbursed expenses</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Pending</span>
                      <Clock className="w-4 h-4 text-yellow-600" />
                    </div>
                    <p className="text-xl font-bold text-yellow-700">{fmt(pendingTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
                  </CardContent>
                </Card>
              </>
            )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder="Search expenses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {listError ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <AlertCircle className="w-8 h-8" />
                <p className="font-medium">Failed to load expenses</p>
                <p className="text-xs">GET /expenses/v1/expense-mgmt-go/list</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : listLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Receipt className="w-8 h-8" />
                <p className="font-medium">No expenses found</p>
                {search || categoryFilter !== "all" || statusFilter !== "all" || deptFilter !== "all"
                  ? <p className="text-sm">Try adjusting your filters</p>
                  : <p className="text-sm">Expense records will appear here once submitted</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense ID</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((exp) => {
                      const st = STATUS_STYLES[exp.status] ?? { cls: "bg-muted text-muted-foreground", icon: null };
                      return (
                        <TableRow key={exp.id}>
                          <TableCell className="font-mono text-sm font-semibold">{exp.id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{CATEGORY_LABELS[exp.category] ?? exp.category}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{exp.department}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {exp.description}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(exp.amount)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{exp.approved_by || "—"}</TableCell>
                          <TableCell className="text-sm">{fmtDate(exp.date)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>
                              {st.icon}{exp.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
