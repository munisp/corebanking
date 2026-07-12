import { useState } from 'react';
import { FileText, Download, Mail, Send, AlertCircle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStatementGeneratorList, useStatementGeneratorStats } from '../hooks/useStatementGenerator';
import type { Statement, StatementStatus, StatementFormat } from '../types/statementGenerator';

const STATUS_CONFIG: Record<StatementStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  delivered: { label: 'Delivered', variant: 'default', icon: <CheckCircle2 className="w-3 h-3" /> },
  generated: { label: 'Generated', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  pending: { label: 'Pending', variant: 'outline', icon: <Clock className="w-3 h-3" /> },
  failed: { label: 'Failed', variant: 'destructive', icon: <AlertCircle className="w-3 h-3" /> },
};

const FORMAT_BADGE: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700',
  mt940: 'bg-blue-100 text-blue-700',
  mt942: 'bg-indigo-100 text-indigo-700',
  csv: 'bg-green-100 text-green-700',
  excel: 'bg-emerald-100 text-emerald-700',
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5" />,
  swift: <Send className="w-3.5 h-3.5" />,
  download: <Download className="w-3.5 h-3.5" />,
};

function fmt(n: number) {
  return `₦${n.toLocaleString()}`;
}

function StatementDetailSheet({ statement, open, onClose }: { statement: Statement | null; open: boolean; onClose: () => void }) {
  if (!statement) return null;
  const cfg = STATUS_CONFIG[statement.status] ?? STATUS_CONFIG.pending;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[580px] sm:max-w-[580px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-600" />
            {statement.id}
          </SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={cfg.variant} className="flex items-center gap-1">
              {cfg.icon}{cfg.label}
            </Badge>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${FORMAT_BADGE[statement.format] ?? 'bg-gray-100 text-gray-700'}`}>
              {statement.format.toUpperCase()}
            </span>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Account No.', statement.accountNumber],
              ['Account Name', statement.accountName],
              ['Period', statement.period],
              ['Type', statement.type],
              ['Channel', statement.deliveryChannel],
              ['Generated', statement.generatedAt ? new Date(statement.generatedAt).toLocaleString() : '—'],
              ['Delivered', statement.deliveredAt ? new Date(statement.deliveredAt).toLocaleString() : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-muted-foreground">{k}</p>
                <p className="font-medium">{v}</p>
              </div>
            ))}
          </div>

          {statement.errorReason && (
            <div className="flex gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{statement.errorReason}</span>
            </div>
          )}

          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              {statement.transactions && statement.transactions.length > 0 && (
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
              )}
              {statement.mt940 && <TabsTrigger value="mt940">MT940</TabsTrigger>}
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Opening Balance', fmt(statement.summary.openingBalance)],
                  ['Closing Balance', fmt(statement.summary.closingBalance)],
                  ['Total Credits', fmt(statement.summary.totalCredits)],
                  ['Total Debits', fmt(statement.summary.totalDebits)],
                  ['Transactions', String(statement.summary.transactionCount)],
                  ['Interest Earned', fmt(statement.summary.interestEarned)],
                  ['Fees Charged', fmt(statement.summary.feesCharged)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-semibold text-sm mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {statement.transactions && statement.transactions.length > 0 && (
              <TabsContent value="transactions" className="mt-4">
                <div className="overflow-x-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Narrative</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statement.transactions.map((t) => (
                        <TableRow key={t.reference}>
                          <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                          <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                          <TableCell className="max-w-[160px] truncate">{t.narrative}</TableCell>
                          <TableCell className="text-right text-green-600">{t.credit > 0 ? fmt(t.credit) : '—'}</TableCell>
                          <TableCell className="text-right text-red-600">{t.debit > 0 ? fmt(t.debit) : '—'}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(t.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            )}

            {statement.mt940 && (
              <TabsContent value="mt940" className="mt-4">
                <pre className="bg-muted p-4 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed">{statement.mt940}</pre>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function StatementGeneratorWorkspace() {
  const { data: listData, isLoading } = useStatementGeneratorList();
  const { data: stats } = useStatementGeneratorStats();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [selected, setSelected] = useState<Statement | null>(null);

  const items = listData?.items ?? [];

  const filtered = items.filter((s) => {
    const matchSearch = !search || [s.id, s.accountNumber, s.accountName, s.period].some(
      (f) => f.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchFormat = filterFormat === 'all' || s.format === filterFormat;
    return matchSearch && matchStatus && matchFormat;
  });

  const statCards = stats
    ? [
        { label: 'Total Statements', value: stats.totalStatements },
        { label: 'Delivered', value: stats.byStatus?.delivered ?? 0 },
        { label: 'Failed', value: stats.byStatus?.failed ?? 0 },
        { label: 'Transactions Rendered', value: (stats.totalTransactionsRendered ?? 0).toLocaleString() },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-cyan-600" />
          Statement Generator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">PDF / MT940 / MT942 account statement generation and delivery</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((c) => (
            <Card key={c.label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.byFormat ?? {}).map(([fmt, count]) => (
            <div key={fmt} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${FORMAT_BADGE[fmt] ?? 'bg-gray-100 text-gray-700'}`}>
              {fmt.toUpperCase()} · {count}
            </div>
          ))}
          {Object.entries(stats.byDeliveryChannel ?? {}).map(([ch, count]) => (
            <div key={ch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {CHANNEL_ICON[ch]}{ch} · {count}
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Statements</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search ID, account, period…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="generated">Generated</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterFormat} onValueChange={setFilterFormat}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All formats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All formats</SelectItem>
                  {['pdf', 'mt940', 'mt942', 'csv', 'excel'].map((f) => (
                    <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filterStatus !== 'all' || filterFormat !== 'all' || search) && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterStatus('all'); setFilterFormat('all'); }}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statement ID</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading statements…</TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No statements found</TableCell>
                  </TableRow>
                )}
                {filtered.map((s) => {
                  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(s)}>
                      <TableCell className="font-mono text-xs font-medium">{s.id}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{s.accountName}</p>
                        <p className="text-xs text-muted-foreground">{s.accountNumber}</p>
                      </TableCell>
                      <TableCell className="text-sm">{s.period}</TableCell>
                      <TableCell className="text-sm capitalize">{s.type}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${FORMAT_BADGE[s.format] ?? 'bg-gray-100 text-gray-700'}`}>
                          {s.format.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          {CHANNEL_ICON[s.deliveryChannel]}
                          {s.deliveryChannel}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(s.generatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
                          {cfg.icon}{cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <StatementDetailSheet
        statement={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
