import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Users, Plus, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useAgentTransactionList, useAgentBankingStats, useCreateAgentTransaction } from '../hooks/useAgentBanking';
import type { AgentTransaction, CreateAgentTransactionPayload } from '../types/agentBanking';

function fmt(v: string | number | null): string {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!isNaN(n) && String(v).trim() !== '') return `₦${n.toLocaleString()}`;
  return String(v);
}

function statusVariant(s: string | null): 'default' | 'secondary' | 'outline' {
  if (!s) return 'outline';
  if (s === 'success' || s === 'completed') return 'default';
  if (s === 'pending') return 'secondary';
  return 'outline';
}

function CreateTransactionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateAgentTransaction();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateAgentTransactionPayload>();

  function onSubmit(data: CreateAgentTransactionPayload) {
    create(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Agent Transaction
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Agent ID <span className="text-destructive">*</span></Label>
              <Input {...register('agent_id', { required: true })} placeholder="AGT-001" />
              {errors.agent_id && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Customer ID <span className="text-destructive">*</span></Label>
              <Input {...register('customer_id', { required: true })} placeholder="CUST-001" />
              {errors.customer_id && <p className="text-xs text-destructive">Required</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Amount (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" {...register('amount', { required: true, min: 0.01, valueAsNumber: true })} />
              {errors.amount && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Transaction Type <span className="text-destructive">*</span></Label>
              <Input {...register('transaction_type', { required: true })} placeholder="deposit, withdrawal…" />
              {errors.transaction_type && <p className="text-xs text-destructive">Required</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Input {...register('status')} placeholder="pending, success…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransactionDetailSheet({ tx, open, onClose }: { tx: AgentTransaction | null; open: boolean; onClose: () => void }) {
  if (!tx) return null;
  const rows: [string, string | number | null][] = [
    ['Transaction ID', tx.transaction_id],
    ['Agent ID', tx.agent_id],
    ['Customer ID', tx.customer_id],
    ['Amount', tx.amount],
    ['Type', tx.transaction_type],
    ['Status', tx.status],
  ];
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[380px] sm:max-w-[380px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Transaction {String(tx.transaction_id ?? '—')}
          </SheetTitle>
          {tx.status && (
            <Badge variant={statusVariant(tx.status)} className="w-fit capitalize">{tx.status}</Badge>
          )}
        </SheetHeader>
        <div className="space-y-3 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right max-w-[60%] break-words">
                {k === 'Amount' ? fmt(v) : (v === null || v === undefined ? '—' : String(v))}
              </span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const PAGE_SIZE = 20;

export default function AgentBanking() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<AgentTransaction | null>(null);

  const { data: listData, isLoading } = useAgentTransactionList(page, PAGE_SIZE, search);
  const { data: stats } = useAgentBankingStats();

  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const noDb = listData?.source === 'no-db';

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Agent Banking
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Agent transactions, network operations, and disbursement tracking
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Transaction
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Transactions', value: stats?.total ?? total },
          { label: 'Current Page', value: `${items.length} records` },
          { label: 'Page', value: `${page} / ${totalPages}` },
          { label: 'Source', value: stats?.source ?? listData?.source ?? '—' },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold mt-1">{String(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Transactions</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agent, customer, type…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Agent ID</TableHead>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                )}
                {!isLoading && noDb && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No database connected — agent transaction data unavailable
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !noDb && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No transactions found</TableCell>
                  </TableRow>
                )}
                {!noDb && items.map((tx, i) => (
                  <TableRow
                    key={`${String(tx.transaction_id)}-${i}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(tx)}
                  >
                    <TableCell className="font-mono text-xs font-medium">{String(tx.transaction_id ?? '—')}</TableCell>
                    <TableCell className="font-mono text-xs">{String(tx.agent_id ?? '—')}</TableCell>
                    <TableCell className="font-mono text-xs">{String(tx.customer_id ?? '—')}</TableCell>
                    <TableCell className="text-sm capitalize">{tx.transaction_type ?? '—'}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(tx.amount)}</TableCell>
                    <TableCell>
                      {tx.status ? (
                        <Badge variant={statusVariant(tx.status)} className="capitalize">{tx.status}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>{total.toLocaleString()} total</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span>Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTransactionDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <TransactionDetailSheet tx={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
