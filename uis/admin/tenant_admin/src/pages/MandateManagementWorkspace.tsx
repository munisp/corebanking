import { useState } from 'react';
import { FileText, TrendingDown, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useMandateList, useMandateStats } from '../hooks/useMandate';
import type { Mandate, MandateStatus } from '../types/mandate';

function fmt(n: number) {
  return `₦${n.toLocaleString()}`;
}

const STATUS_CONFIG: Record<MandateStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  suspended: { label: 'Suspended', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'outline' },
};

function MandateDetailSheet({ mandate, open, onClose }: { mandate: Mandate | null; open: boolean; onClose: () => void }) {
  if (!mandate) return null;
  const cfg = STATUS_CONFIG[mandate.status] ?? STATUS_CONFIG.active;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[460px] sm:max-w-[460px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-600" /> {mandate.id}
          </SheetTitle>
          <div className="flex gap-2 mt-1">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            <Badge variant="outline" className="capitalize">{mandate.type}</Badge>
          </div>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          {[
            ['NIBSS Ref', mandate.nibssMandateRef],
            ['Account No.', mandate.accountNumber],
            ['Account Name', mandate.accountName],
            ['Beneficiary', mandate.beneficiary],
            ['Type', mandate.type],
            ['Amount', mandate.amount > 0 ? fmt(mandate.amount) : 'Variable'],
            ['Currency', mandate.currency],
            ['Frequency', mandate.frequency],
            ['Start Date', mandate.startDate],
            ['End Date', mandate.endDate],
            ['Next Execution', mandate.nextExecutionDate || '—'],
            ['Total Executions', String(mandate.totalExecutions)],
            ['Total Debited', fmt(mandate.totalDebited)],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-muted-foreground">{k}</p>
              <p className="font-medium">{v}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function MandateManagementWorkspace() {
  const { data: listData, isLoading } = useMandateList();
  const { data: stats } = useMandateStats();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selected, setSelected] = useState<Mandate | null>(null);

  const items = listData?.items ?? [];

  const filtered = items.filter((m) => {
    const matchSearch = !search || [m.id, m.accountNumber, m.accountName, m.beneficiary, m.nibssMandateRef].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    const matchType = filterType === 'all' || m.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const statCards = stats
    ? [
        { label: 'Total Mandates', value: stats.totalMandates },
        { label: 'Active', value: stats.active },
        { label: 'Suspended', value: stats.suspended },
        { label: 'Total Debited', value: fmt(stats.totalDebited) },
        { label: 'Total Executions', value: stats.totalExecutions.toLocaleString() },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-violet-600" />
          Mandate Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          NIBSS direct debit mandates — consent, execution, and reconciliation
        </p>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.types ?? {}).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 capitalize">
                {type.replace('-', ' ')} · {count}
              </div>
            ))}
          </div>
        </>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Mandates</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search account, beneficiary…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-56"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.keys(STATUS_CONFIG).map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="direct-debit">Direct Debit</SelectItem>
                  <SelectItem value="standing-order">Standing Order</SelectItem>
                </SelectContent>
              </Select>
              {(search || filterStatus !== 'all' || filterType !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterStatus('all'); setFilterType('all'); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mandate ID</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Exec.</TableHead>
                  <TableHead className="text-right">Total Debited</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Loading mandates…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No mandates found</TableCell></TableRow>}
                {filtered.map((m) => {
                  const cfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.active;
                  return (
                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(m)}>
                      <TableCell className="font-mono text-xs font-medium">{m.id}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{m.accountName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.accountNumber}</p>
                      </TableCell>
                      <TableCell className="text-sm">{m.beneficiary}</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium capitalize px-2 py-0.5 rounded bg-violet-100 text-violet-700">
                          {m.type.replace('-', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{m.amount > 0 ? fmt(m.amount) : 'Variable'}</TableCell>
                      <TableCell className="capitalize text-sm">{m.frequency}</TableCell>
                      <TableCell className="text-sm">{m.nextExecutionDate || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(m.totalDebited)}</TableCell>
                      <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                      <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <MandateDetailSheet mandate={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
