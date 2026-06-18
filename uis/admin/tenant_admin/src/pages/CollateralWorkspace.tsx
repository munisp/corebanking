import { useState } from 'react';
import { Lock, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useValuationList, useValuationSummary } from '../hooks/useCollateralValuation';
import type { Valuation, ValuationStatus, CollateralType } from '../types/collateralValuation';

const fmtB = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(0)}M`;
  return `₦${n.toLocaleString()}`;
};

const STATUS_CFG: Record<ValuationStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  current: { label: 'Current', variant: 'default' },
  expiring_soon: { label: 'Expiring Soon', variant: 'secondary' },
  expired: { label: 'Expired', variant: 'destructive' },
};

const TYPE_COLORS: Record<string, string> = {
  property: 'bg-blue-100 text-blue-700',
  vehicle: 'bg-amber-100 text-amber-700',
  equipment: 'bg-orange-100 text-orange-700',
  securities: 'bg-green-100 text-green-700',
  cash_deposit: 'bg-emerald-100 text-emerald-700',
  guarantee: 'bg-purple-100 text-purple-700',
};

function ValuationDetailSheet({ val, open, onClose }: { val: Valuation | null; open: boolean; onClose: () => void }) {
  if (!val) return null;
  const cfg = STATUS_CFG[val.status] ?? STATUS_CFG.current;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[460px] sm:max-w-[460px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-stone-700" />
            {val.id}
          </SheetTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${TYPE_COLORS[val.collateral_type] ?? 'bg-gray-100 text-gray-700'}`}>
              {val.collateral_type.replace(/_/g, ' ')}
            </span>
          </div>
        </SheetHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground text-xs">{val.description}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              ['Collateral ID', val.collateral_id],
              ['Owner', val.owner],
              ['Valuer', val.valuer],
              ['Currency', val.currency],
              ['Lien Status', val.lien_status],
              ['Valuation Date', val.valuation_date],
              ['Expiry Date', val.expiry_date],
              ['Insurance Expiry', val.insurance_expiry],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-muted-foreground text-xs">{k}</p>
                <p className="font-medium capitalize">{v}</p>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            {[
              ['Market Value', fmtB(val.market_value), 'text-slate-900'],
              ['Forced Sale Value', fmtB(val.forced_sale_value), 'text-blue-700'],
              ['Net Realizable', fmtB(val.net_realizable_value), 'text-green-700'],
              ['Haircut', `${val.haircut_pct}%`, 'text-amber-700'],
              ['Insurance Value', fmtB(val.insurance_value), 'text-slate-600'],
            ].map(([k, v, cls]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className={`font-bold ${cls}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function CollateralWorkspace() {
  const { data: listData, isLoading } = useValuationList();
  const { data: summary } = useValuationSummary();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState<Valuation | null>(null);

  const items = listData?.items ?? [];
  const filtered = items.filter(v => {
    const matchSearch = !search || [v.id, v.owner, v.description, v.collateral_type, v.valuer].some(
      f => f?.toLowerCase().includes(search.toLowerCase())
    );
    return matchSearch && (filterType === 'all' || v.collateral_type === filterType) && (filterStatus === 'all' || v.status === filterStatus);
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Lock className="w-6 h-6 text-stone-700" />
          Collateral Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pledges, liens and valuations — property, vehicle, securities, equipment, cash deposit
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Valuations', value: summary.totalValuations },
            { label: 'Total Market Value', value: fmtB(summary.totalMarketValue) },
            { label: 'Total FSV', value: fmtB(summary.totalFSV) },
            { label: 'Avg Haircut', value: `${summary.avgHaircut}%` },
          ].map(c => (
            <Card key={c.label}><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold mt-1">{c.value}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Collateral Register</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search owner, type, valuer…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-48" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {(['property', 'vehicle', 'equipment', 'securities', 'cash_deposit', 'guarantee'] as CollateralType[]).map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              {(search || filterType !== 'all' || filterStatus !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterType('all'); setFilterStatus('all'); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Market Value</TableHead>
                  <TableHead className="text-right">FSV</TableHead>
                  <TableHead className="text-right">Haircut</TableHead>
                  <TableHead>Lien</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No collateral found</TableCell></TableRow>}
                {filtered.map(v => {
                  const cfg = STATUS_CFG[v.status] ?? STATUS_CFG.current;
                  return (
                    <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(v)}>
                      <TableCell className="font-mono text-xs font-medium">{v.id}</TableCell>
                      <TableCell className="text-sm max-w-[140px] truncate">{v.owner}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${TYPE_COLORS[v.collateral_type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {v.collateral_type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{v.description}</TableCell>
                      <TableCell className="text-right font-bold">{fmtB(v.market_value)}</TableCell>
                      <TableCell className="text-right text-blue-700">{fmtB(v.forced_sale_value)}</TableCell>
                      <TableCell className="text-right text-sm">{v.haircut_pct}%</TableCell>
                      <TableCell className="text-sm capitalize">{v.lien_status}</TableCell>
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

      <ValuationDetailSheet val={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
