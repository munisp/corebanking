import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Percent,
  Play,
  CheckCircle,
  AlertCircle,
  BarChart3,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { interestAccrualApi, type AccrualBatchResult, type AccrualResult } from "@/api/financeApi";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const PRODUCT_COLORS: Record<string, string> = {
  savings:      "bg-blue-100 text-blue-800",
  fixed_deposit:"bg-purple-100 text-purple-800",
  loan:         "bg-orange-100 text-orange-800",
  overdraft:    "bg-red-100 text-red-800",
  mortgage:     "bg-green-100 text-green-800",
  placement:    "bg-indigo-100 text-indigo-800",
};

const ACCRUAL_PRODUCTS = [
  { productType: "savings",       glDebit: "5101", glCredit: "2102", rate: "4.5%",  basis: 365, description: "Interest Expense on Savings → Savings Deposit Payable" },
  { productType: "fixed_deposit", glDebit: "5102", glCredit: "2103", rate: "14.0%", basis: 365, description: "Interest Expense on FD → FD Payable" },
  { productType: "loan",          glDebit: "1301", glCredit: "4101", rate: "22.0%", basis: 360, description: "Interest Receivable on Loans → Interest Income" },
  { productType: "overdraft",     glDebit: "1301", glCredit: "4101", rate: "28.0%", basis: 365, description: "Interest Receivable on OD → Interest Income" },
  { productType: "mortgage",      glDebit: "1309", glCredit: "4102", rate: "18.0%", basis: 365, description: "Interest Receivable on Mortgage → Interest Income" },
  { productType: "placement",     glDebit: "1104", glCredit: "4105", rate: "12.0%", basis: 365, description: "Placement Receivable → Interest on Placements" },
];

export default function InterestAccrualWorkspace() {
  const [lastBatch, setLastBatch] = useState<AccrualBatchResult | null>(null);

  const accrualMutation = useMutation({
    mutationFn: () => interestAccrualApi.runBatch(),
    onSuccess: (data) => {
      setLastBatch(data);
      toast.success(`Accrual batch ${data.batchId} completed — ${data.totalAccounts} accounts processed`);
    },
    onError: () => toast.error("Failed to run accrual batch"),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        <PageHeader
          label="Finance & Accounting"
          title="Interest Accrual"
          description="Daily accrual computation for savings, FDs, loans and overdrafts — /interest-accrual-engine/v1/interest/accrue"
          icon={<Percent className="w-8 h-8" />}
          action={{ label: "Run Accrual Batch", onClick: () => accrualMutation.mutate() }}
        />

        {/* Trigger card */}
        <Card className="border-2 border-dashed">
          <CardContent className="flex items-center justify-between p-6 flex-wrap gap-4">
            <div>
              <p className="font-semibold text-lg">Daily Interest Accrual</p>
              <p className="text-sm text-muted-foreground mt-1">
                POST <span className="font-mono">/interest-accrual-engine/v1/interest/accrue</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Computes and posts journal entries for all active accounts across 6 product types
              </p>
            </div>
            <Button
              size="lg"
              disabled={accrualMutation.isPending}
              onClick={() => accrualMutation.mutate()}
            >
              <Play className="w-5 h-5 mr-2" />
              {accrualMutation.isPending ? "Processing…" : "Run Accrual Batch"}
            </Button>
          </CardContent>
        </Card>

        {/* Last Batch Results */}
        {accrualMutation.isPending && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        )}

        {lastBatch && (
          <>
            {/* Batch KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Batch ID</span>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-sm font-bold font-mono">{lastBatch.batchId}</p>
                  <p className="text-xs text-muted-foreground mt-1">{lastBatch.businessDate}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Accounts</span>
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold">{lastBatch.totalAccounts}</p>
                  <p className="text-xs text-muted-foreground mt-1">{lastBatch.journalEntriesPosted} journal entries</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Interest Income</span>
                    <ArrowUpCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-xl font-bold text-green-700">{fmt(lastBatch.interestIncome)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Loan & placement income</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Interest Expense</span>
                    <ArrowDownCircle className="w-4 h-4 text-orange-600" />
                  </div>
                  <p className="text-xl font-bold text-orange-700">{fmt(lastBatch.interestExpense)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Savings & FD expense</p>
                </CardContent>
              </Card>
            </div>

            {/* Pipeline Trace */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" /> Pipeline Trace
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {Object.entries(lastBatch.pipeline).map(([key, val]) => (
                    <div key={key} className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                      <p className="text-xs text-green-700 font-mono font-semibold">{key.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{String(val)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Per-Account Results */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Accrual Results</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Annual Rate</TableHead>
                        <TableHead className="text-right">Daily Accrual</TableHead>
                        <TableHead>Debit GL</TableHead>
                        <TableHead>Credit GL</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastBatch.results.map((result: AccrualResult) => (
                        <TableRow key={result.accountId}>
                          <TableCell className="font-mono text-sm">{result.accountId}</TableCell>
                          <TableCell className="font-medium text-sm">{result.accountName}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRODUCT_COLORS[result.productType] ?? "bg-muted text-muted-foreground"}`}>
                              {result.productType.replace("_", " ")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">{fmt(result.principal)}</TableCell>
                          <TableCell className="text-right font-mono">{result.annualRate}%</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(result.dailyAccrual)}</TableCell>
                          <TableCell className="font-mono text-sm text-green-700">{result.glDebitCode}</TableCell>
                          <TableCell className="font-mono text-sm text-orange-700">{result.glCreditCode}</TableCell>
                          <TableCell>
                            <Badge variant={result.status === "accrued" ? "default" : "secondary"}>
                              {result.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Accrual Products Reference */}
        {!lastBatch && !accrualMutation.isPending && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5" /> Accrual Product Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Sample Rate</TableHead>
                    <TableHead>Day Basis</TableHead>
                    <TableHead>Debit GL</TableHead>
                    <TableHead>Credit GL</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ACCRUAL_PRODUCTS.map((p) => (
                    <TableRow key={p.productType}>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRODUCT_COLORS[p.productType] ?? "bg-muted text-muted-foreground"}`}>
                          {p.productType.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-semibold">{p.rate}</TableCell>
                      <TableCell>{p.basis}</TableCell>
                      <TableCell className="font-mono text-green-700">{p.glDebit}</TableCell>
                      <TableCell className="font-mono text-orange-700">{p.glCredit}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {accrualMutation.isError && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Accrual batch failed</p>
                <p className="text-sm text-muted-foreground">
                  POST /interest-accrual-engine/v1/interest/accrue returned an error
                </p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => accrualMutation.mutate()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
