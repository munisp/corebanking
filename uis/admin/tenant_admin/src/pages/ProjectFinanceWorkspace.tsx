import React, { useEffect, useState } from 'react';
import { Building2, ChevronRight, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useProjectDealList, useProjectFinanceStats } from '../hooks/useProjectFinance';
import { projectFinanceService } from '../services/projectFinanceService';
import type { ProjectDeal } from '../types/projectFinance';
import kybService from '../services/kybService';
import type { Business } from '../types/kyb';

const fmtB = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  return `₦${n.toLocaleString()}`;
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  structuring: 'secondary',
  closed: 'outline',
  defaulted: 'destructive',
  completed: 'outline',
};

const SECTOR_COLORS: Record<string, string> = {
  power: 'bg-yellow-100 text-yellow-700',
  transport: 'bg-blue-100 text-blue-700',
  telecoms: 'bg-purple-100 text-purple-700',
  oil_gas: 'bg-amber-100 text-amber-700',
  real_estate: 'bg-green-100 text-green-700',
  agriculture: 'bg-emerald-100 text-emerald-700',
  healthcare: 'bg-red-100 text-red-700',
};

const SECTORS = ['infrastructure', 'manufacturing', 'transport', 'energy', 'agriculture', 'technology', 'real_estate', 'healthcare', 'other'];

function CreateDealDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [projectName, setProjectName] = useState('');
  const [sector, setSector] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [tenor, setTenor] = useState('');
  const [debtEquityRatio, setDebtEquityRatio] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBizLoading(true);
    kybService.getAllBusinesses()
      .then(setBusinesses)
      .catch(() => setBusinesses([]))
      .finally(() => setBizLoading(false));
  }, [open]);

  function reset() {
    setSelectedBiz(null);
    setProjectName('');
    setSector('');
    setTotalCost('');
    setCurrency('NGN');
    setTenor('');
    setDebtEquityRatio('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBiz) { toast.error('Please select a business'); return; }
    if (!projectName.trim()) { toast.error('Project name is required'); return; }
    if (!sector) { toast.error('Please select a sector'); return; }
    if (!totalCost || Number(totalCost) <= 0) { toast.error('Enter a valid total cost'); return; }
    setSubmitting(true);
    try {
      await projectFinanceService.create({
        project_name: projectName.trim(),
        sponsor: selectedBiz.name,
        business_id: selectedBiz.id,
        sector,
        total_cost: Number(totalCost),
        currency,
        tenor: tenor.trim() || undefined,
        debt_equity_ratio: debtEquityRatio.trim() || undefined,
      });
      toast.success('Project deal created');
      reset();
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to create project deal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Project Deal</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Business (Sponsor) <span className="text-destructive">*</span></Label>
            <Popover open={bizOpen} onOpenChange={setBizOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" type="button" className="w-full justify-between" disabled={bizLoading}>
                  {selectedBiz ? selectedBiz.name : bizLoading ? 'Loading...' : 'Select business'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search business..." />
                  <CommandList>
                    <CommandEmpty>No business found.</CommandEmpty>
                    <CommandGroup>
                      {businesses.map((b) => (
                        <CommandItem
                          key={b.id}
                          value={`${b.name} ${b.registration_number ?? ''}`}
                          onSelect={() => { setSelectedBiz(b); setBizOpen(false); }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', selectedBiz?.id === b.id ? 'opacity-100' : 'opacity-0')} />
                          <div className="flex flex-col">
                            <span className="font-medium">{b.name}</span>
                            {b.registration_number && (
                              <span className="text-xs text-muted-foreground">Reg: {b.registration_number}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label>Project Name <span className="text-destructive">*</span></Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Lagos-Ibadan Highway Phase 2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Sector <span className="text-destructive">*</span></Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Total Cost <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tenor</Label>
              <Input value={tenor} onChange={(e) => setTenor(e.target.value)} placeholder="e.g. 10 years" />
            </div>
            <div className="space-y-1">
              <Label>Debt/Equity Ratio</Label>
              <Input value={debtEquityRatio} onChange={(e) => setDebtEquityRatio(e.target.value)} placeholder="e.g. 70:30" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Deal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DealDetailSheet({ deal, open, onClose }: { deal: ProjectDeal | null; open: boolean; onClose: () => void }) {
  if (!deal) return null;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[440px] sm:max-w-[440px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-700" />
            {deal.id}
          </SheetTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANT[deal.status] ?? 'outline'}>{deal.status}</Badge>
            <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${SECTOR_COLORS[deal.sector] ?? 'bg-gray-100 text-gray-700'}`}>
              {deal.sector.replace(/_/g, ' ')}
            </span>
          </div>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          {[
            ['Project', deal.project_name],
            ['Sponsor', deal.sponsor],
            ['Currency', deal.currency],
            ['Total Cost', fmtB(deal.total_cost)],
            ['Debt/Equity Ratio', deal.debt_equity_ratio],
            ['Tenor', deal.tenor],
            ['DSCR', deal.dscr],
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

export default function ProjectFinanceWorkspace() {
  const { data, isLoading, refetch } = useProjectDealList();
  const { data: stats } = useProjectFinanceStats();
  const [selected, setSelected] = useState<ProjectDeal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const items = data?.items ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cyan-700" />
            Project Finance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Infrastructure financing, SPV structuring, DSCR analysis and milestone disbursement
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Deal
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects', value: stats?.total_projects ?? items.length },
          { label: 'Total Investment', value: stats ? fmtB(stats.total_investment) : '—' },
          { label: 'Active Deals', value: items.filter(i => i.status === 'active').length || '—' },
          { label: 'Sectors Covered', value: new Set(items.map(i => i.sector)).size || '—' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-bold mt-1">{String(c.value)}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Project Deal Register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project ID</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Sponsor</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">D/E Ratio</TableHead>
                  <TableHead>Tenor</TableHead>
                  <TableHead className="text-right">DSCR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && items.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No projects found</TableCell></TableRow>}
                {items.map(d => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(d)}>
                    <TableCell className="font-mono text-xs font-medium">{d.id}</TableCell>
                    <TableCell className="font-medium text-sm max-w-[160px] truncate">{d.project_name}</TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">{d.sponsor}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${SECTOR_COLORS[d.sector] ?? 'bg-gray-100 text-gray-700'}`}>
                        {d.sector.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold">{fmtB(d.total_cost)}</TableCell>
                    <TableCell className="text-right text-sm">{d.debt_equity_ratio}</TableCell>
                    <TableCell className="text-sm">{d.tenor}</TableCell>
                    <TableCell className="text-right text-sm">{d.dscr}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[d.status] ?? 'outline'}>{d.status}</Badge></TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DealDetailSheet deal={selected} open={!!selected} onClose={() => setSelected(null)} />
      <CreateDealDialog open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => refetch()} />
    </div>
  );
}
