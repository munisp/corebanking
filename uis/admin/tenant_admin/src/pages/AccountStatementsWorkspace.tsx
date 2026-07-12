import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';

import { useAllAccounts, useLedgerTransactions } from '@/hooks/useAccount';
import type { AccountApplication, LedgerTransaction } from '@/types/account';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s?: string | null) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

function fmtAmount(amount: string) {
  const n = parseFloat(amount);
  if (isNaN(n)) return '—';
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function capitalize(s?: string) {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function isCredit(txn: LedgerTransaction, ledgerId: string) {
  return txn.payee === ledgerId;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function TxnStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    success:  { label: 'Success',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    failed:   { label: 'Failed',   className: 'bg-red-100 text-red-700 border-red-200' },
    pending:  { label: 'Pending',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
    reversed: { label: 'Reversed', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  };
  const cfg = map[status] ?? { label: capitalize(status), className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function TagBadge({ tag }: { tag: string }) {
  const map: Record<string, string> = {
    external_credit: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    external_debit:  'bg-red-100 text-red-700 border-red-200',
    internal_credit: 'bg-blue-100 text-blue-700 border-blue-200',
    internal_debit:  'bg-orange-100 text-orange-700 border-orange-200',
    transfer:        'bg-purple-100 text-purple-700 border-purple-200',
    fee:             'bg-amber-100 text-amber-700 border-amber-200',
    reversal:        'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${map[tag] ?? 'bg-gray-100 text-gray-600'}`}>
      {capitalize(tag)}
    </Badge>
  );
}

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({ account, selected, onClick }: {
  account: AccountApplication; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/50 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{account.name}</p>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">{account.account_number}</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">{(account.account_currency as string) ?? 'NGN'}</Badge>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground capitalize">{account.account_type ?? '—'}</span>
        <span className="text-xs text-muted-foreground font-mono">ID: {account.id}</span>
      </div>
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onPage }: {
  page: number; total: number; pageSize: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between px-2 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-2">{page} / {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, className }: {
  label: string; value: string; icon: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted shrink-0">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountStatementsWorkspace() {
  const [selectedAccount, setSelectedAccount] = useState<AccountApplication | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [txnPage, setTxnPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: accounts = [], isLoading: accountsLoading } = useAllAccounts();
  const {
    data: txnData,
    isLoading: txnLoading,
    isError: txnError,
    refetch: refetchTxns,
  } = useLedgerTransactions(selectedAccount ? String(selectedAccount.id) : undefined, txnPage, PAGE_SIZE);

  const transactions = txnData?.transactions ?? [];

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        (a.name ?? '').toLowerCase().includes(q) ||
        (a.account_number ?? '').includes(q),
    );
  }, [accounts, accountSearch]);

  const allTags = useMemo(() => Array.from(new Set(transactions.map((t) => t.tag).filter(Boolean))).sort(), [transactions]);
  const allStatuses = useMemo(() => Array.from(new Set(transactions.map((t) => t.status).filter(Boolean))).sort(), [transactions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      const matchSearch =
        !q ||
        t.id.toLowerCase().includes(q) ||
        t.transaction_id.toLowerCase().includes(q) ||
        (t.payer ?? '').toLowerCase().includes(q) ||
        (t.payee ?? '').toLowerCase().includes(q) ||
        (t.note ?? '').toLowerCase().includes(q);
      return matchSearch &&
        (tagFilter === 'all' || t.tag === tagFilter) &&
        (statusFilter === 'all' || t.status === statusFilter);
    });
  }, [transactions, search, tagFilter, statusFilter]);

  const hasFilters = search || tagFilter !== 'all' || statusFilter !== 'all';
  function clearFilters() { setSearch(''); setTagFilter('all'); setStatusFilter('all'); }

  // Summary stats from visible transactions
  const totalCredit = transactions
    .filter((t) => selectedAccount && t.payee === String(selectedAccount.id))
    .reduce((s, t) => s + parseFloat(t.amount || '0'), 0);
  const totalDebit = transactions
    .filter((t) => selectedAccount && t.payer === String(selectedAccount.id))
    .reduce((s, t) => s + parseFloat(t.amount || '0'), 0);

  function handleSelectAccount(account: AccountApplication) {
    setSelectedAccount(account);
    setTxnPage(1);
    setSearch('');
    setTagFilter('all');
    setStatusFilter('all');
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="h-5 w-5 text-blue-700" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Account Statements</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Select an account to view its transaction history from the ledger
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* LEFT — Account picker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Select Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or account number..."
                className="pl-9"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[calc(100vh-340px)]">
              {accountsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No accounts found</p>
              ) : (
                <div className="space-y-2 pr-2">
                  {filteredAccounts.map((a) => (
                    <AccountCard
                      key={a.account_number}
                      account={a}
                      selected={selectedAccount?.account_number === a.account_number}
                      onClick={() => handleSelectAccount(a)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* RIGHT — Transaction list */}
        <div className="space-y-4">
          {!selectedAccount ? (
            <div className="flex flex-col items-center justify-center h-80 rounded-xl border-2 border-dashed text-muted-foreground gap-3">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="font-medium">Select an account to view transactions</p>
              <p className="text-sm text-center max-w-xs">
                Pick an account from the panel on the left to load its ledger history
              </p>
            </div>
          ) : (
            <>
              {/* Account summary header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{selectedAccount.name}</p>
                  <p className="font-mono text-sm text-muted-foreground">{selectedAccount.account_number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Account ID: {selectedAccount.id}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchTxns()} disabled={txnLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${txnLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {/* Summary cards */}
              {transactions.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <SummaryCard
                    label="Total Credits"
                    value={`₦${totalCredit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
                    icon={<ArrowUpRight className="h-4 w-4 text-emerald-600" />}
                    className="border-emerald-100"
                  />
                  <SummaryCard
                    label="Total Debits"
                    value={`₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
                    icon={<ArrowDownRight className="h-4 w-4 text-red-500" />}
                    className="border-red-100"
                  />
                  <SummaryCard
                    label="Transactions"
                    value={String(transactions.length)}
                    icon={<FileText className="h-4 w-4 text-blue-500" />}
                  />
                </div>
              )}

              <Separator />

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ID, payer, payee, note..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {allTags.length > 1 && (
                    <Select value={tagFilter} onValueChange={setTagFilter}>
                      <SelectTrigger className="w-44">
                        <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Tag" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tags</SelectItem>
                        {allTags.map((t) => <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {allStatuses.length > 1 && (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {allStatuses.map((s) => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right text-red-600">Debit</TableHead>
                      <TableHead className="text-right text-emerald-600">Credit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txnLoading ? (
                      <TableSkeleton cols={8} />
                    ) : txnError ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <TriangleAlert className="h-8 w-8 text-red-400" />
                            <p className="font-medium">Failed to load transactions</p>
                            <Button variant="outline" size="sm" onClick={() => refetchTxns()}>Retry</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                          {hasFilters ? 'No transactions match your filters' : 'No transactions found for this account'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.slice((txnPage - 1) * PAGE_SIZE, txnPage * PAGE_SIZE).map((txn) => {
                        const credit = selectedAccount.ledger_id && txn.payee === String(selectedAccount.ledger_id);
                        return (
                          <TableRow key={txn.id}>
                            <TableCell className="text-sm whitespace-nowrap">{fmtDate(txn.completed_at ?? txn.created_at)}</TableCell>
                            <TableCell><TagBadge tag={txn.tag} /></TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">
                              {txn.payer_name ?? txn.payer}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">
                              {txn.payee_name ?? txn.payee}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-red-600 font-medium">
                              {!credit ? fmtAmount(txn.amount) : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                              {credit ? fmtAmount(txn.amount) : '—'}
                            </TableCell>
                            <TableCell><TxnStatusBadge status={txn.status} /></TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                              {txn.note || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <Pagination
                  page={txnPage}
                  total={filtered.length}
                  pageSize={PAGE_SIZE}
                  onPage={setTxnPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
