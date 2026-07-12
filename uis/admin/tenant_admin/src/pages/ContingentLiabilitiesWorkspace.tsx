import { useState } from 'react';
import { AlertTriangle, Search, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useContingentLiabilityList } from '../hooks/useContingentLiabilities';
import type { ContingentLiability, LiabilityType } from '../types/contingentLiabilities';

const fmtB = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  return `₦${n.toLocaleString()}`;
};

const TYPE_COLORS: Record<LiabilityType, string> = {
  letter_of_credit: 'bg-blue-100 text-blue-700',
  performance_guarantee: 'bg-purple-100 text-purple-700',
  loan_commitment: 'bg-amber-100 text-amber-700',
  litigation: 'bg-red-100 text-red-700',
  acceptance: 'bg-green-100 text-green-700',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  contingent: 'secondary',
  settled: 'outline',
  defaulted: 'destructive',
};

function LiabilityDetailSheet({ item, open, onClose }: { item: ContingentLiability | null; open: boolean; onClose: () => void }) {
  if (!item) return null;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[440px] sm:max-w-[440px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            {item.id}
          </SheetTitle>
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded capitalize ${TYPE_COLORS[item.liability_type] ?? 'bg-gray-100 text-gray-700'}`}>
              {item.liability_type.replace(/_/g, ' ')}
            </span>
            <Badge variant={STATUS_VARIANT[item.status] ?? 'outline'}>{item.status}</Badge>
          </div>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground italic">{item.description}</p>
          {[
            ['Counterparty', item.counterparty],
            ['Currency', item.currency],
            ['Max Exposure', fmtB(item.max_exposure)],
            ['Probability', `${item.probability}%`],
            ['Expected Loss', fmtB(item.expected_loss)],
            ['Expiry Date', item.expiry_date],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right">{v}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ContingentLiabilitiesWorkspace() {
  const { data, isLoading } = useContingentLiabilityList();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ContingentLiability | null>(null);

  const items = data?.items ?? [];
  const filtered = items.filter(i =>
    !search || [i.id, i.counterparty, i.liability_type, i.status].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalExposure = items.reduce((s, i) => s + i.max_exposure, 0);
  const totalExpectedLoss = items.reduce((s, i) => s + i.expected_loss, 0);
  const activeCount = items.filter(i => i.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          Contingent Liabilities
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          LCs, performance guarantees, loan commitments, litigation and off-balance sheet exposures
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: items.length },
          { label: 'Active', value: activeCount },
          { label: 'Total Max Exposure', value: fmtB(totalExposure) },
          { label: 'Total Expected Loss', value: fmtB(totalExpectedLoss) },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-bold mt-1">{String(c.value)}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Liability Register</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search counterparty, type…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-56" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Max Exposure</TableHead>
                  <TableHead className="text-right">Probability</TableHead>
                  <TableHead className="text-right">Expected Loss</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No liabilities found</TableCell></TableRow>}
                {filtered.map(item => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(item)}>
                    <TableCell className="font-mono text-xs font-medium">{item.id}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${TYPE_COLORS[item.liability_type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {item.liability_type.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[140px] truncate">{item.counterparty}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{item.description}</TableCell>
                    <TableCell className="text-right font-bold">{fmtB(item.max_exposure)}</TableCell>
                    <TableCell className="text-right text-sm">{item.probability}%</TableCell>
                    <TableCell className="text-right text-sm">{fmtB(item.expected_loss)}</TableCell>
                    <TableCell className="text-sm">{item.expiry_date}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[item.status] ?? 'outline'}>{item.status}</Badge></TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LiabilityDetailSheet item={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
