import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Scale, Calculator, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useValuationList, useValuationSummary, useComputeFSV } from '../hooks/useCollateralValuation';
import type { ComputeFSVPayload, FSVResult, CollateralType, LocationGrade, Condition, Valuation } from '../types/collateralValuation';

const fmtB = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  return `₦${n.toLocaleString()}`;
};

const COLLATERAL_TYPES: CollateralType[] = ['property', 'vehicle', 'equipment', 'securities', 'cash_deposit', 'guarantee'];
const LOCATION_GRADES: LocationGrade[] = ['prime', 'good', 'average', 'poor'];
const CONDITIONS: Condition[] = ['excellent', 'good', 'fair', 'poor'];

function FSVCalculator() {
  const { mutate: compute, isPending, data: result } = useComputeFSV();
  const { register, control, handleSubmit, formState: { errors } } = useForm<ComputeFSVPayload>({
    defaultValues: { collateral_type: 'property', location_grade: 'good', condition: 'good', age_years: 0 },
  });

  function onSubmit(data: ComputeFSVPayload) { compute(data); }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="w-4 h-4" /> FSV Calculator</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Collateral Type <span className="text-destructive">*</span></Label>
              <Controller name="collateral_type" control={control} rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={v => field.onChange(v as CollateralType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLLATERAL_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Market Value (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" {...register('market_value', { required: true, min: 0.01, valueAsNumber: true })} />
              {errors.market_value && <p className="text-xs text-destructive">Required and must be positive</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Age (years)</Label>
                <Input type="number" step="0.5" {...register('age_years', { min: 0, valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Location Grade</Label>
                <Controller name="location_grade" control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={v => field.onChange(v as LocationGrade)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LOCATION_GRADES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Condition</Label>
                <Controller name="condition" control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={v => field.onChange(v as Condition)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Computing…' : 'Compute FSV'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">FSV Result</CardTitle></CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Enter collateral details and click Compute FSV</p>
          ) : (
            <FSVResultView result={result} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FSVResultView({ result }: { result: FSVResult }) {
  const discountPct = result.haircutPct;
  const discountColor = discountPct > 50 ? 'bg-red-500' : discountPct > 30 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="space-y-4 text-sm">
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
        <p className="text-muted-foreground text-xs mb-1">Forced Sale Value</p>
        <p className="text-3xl font-bold text-blue-700">{fmtB(result.forcedSaleValue)}</p>
        <p className="text-xs text-muted-foreground mt-1">from {fmtB(result.marketValue)} market value</p>
      </div>
      <div className="space-y-2">
        {[
          ['Collateral Type', result.collateralType.replace(/_/g, ' ')],
          ['Total Haircut', `${result.haircutPct}%`],
          ['Age Adjustment', `${result.ageAdjustment > 0 ? '+' : ''}${result.ageAdjustment}%`],
          ['Location Adjustment', `${result.locationAdjustment > 0 ? '+' : ''}${result.locationAdjustment}%`],
          ['Condition Adjustment', `${result.conditionAdjustment > 0 ? '+' : ''}${result.conditionAdjustment}%`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b pb-1 last:border-0">
            <span className="text-muted-foreground capitalize">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Discount {discountPct}%</span>
          <span>Retained {(100 - discountPct).toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${discountColor}`} style={{ width: `${discountPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function ValuationDetailSheet({ val, open, onClose }: { val: Valuation | null; open: boolean; onClose: () => void }) {
  if (!val) return null;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-stone-700" />
            {val.id}
          </SheetTitle>
          <div className="flex gap-2">
            <Badge variant={val.status === 'current' ? 'default' : val.status === 'expiring_soon' ? 'secondary' : 'destructive'}>
              {val.status.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className="capitalize">{val.collateral_type.replace(/_/g, ' ')}</Badge>
          </div>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground italic">{val.description}</p>
          {[
            ['Owner', val.owner],
            ['Valuer', val.valuer],
            ['Valuation Date', val.valuation_date],
            ['Expiry Date', val.expiry_date],
            ['Lien Status', val.lien_status],
            ['Currency', val.currency],
            ['Market Value', fmtB(val.market_value)],
            ['Forced Sale Value', fmtB(val.forced_sale_value)],
            ['Net Realizable Value', fmtB(val.net_realizable_value)],
            ['Haircut', `${val.haircut_pct}%`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right capitalize">{v}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function CollateralValuationWorkspace() {
  const { data: listData, isLoading } = useValuationList();
  const { data: summary } = useValuationSummary();
  const [selected, setSelected] = useState<Valuation | null>(null);

  const items = listData?.items ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="w-6 h-6 text-stone-700" />
          Collateral Valuation
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          FSV computation, haircut modeling, insurance and lien tracking
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

      <Tabs defaultValue="calculator">
        <TabsList>
          <TabsTrigger value="calculator" className="gap-2"><Calculator className="w-4 h-4" /> FSV Calculator</TabsTrigger>
          <TabsTrigger value="register">Valuation Register</TabsTrigger>
        </TabsList>
        <TabsContent value="calculator" className="mt-4"><FSVCalculator /></TabsContent>
        <TabsContent value="register" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Market Value</TableHead>
                      <TableHead className="text-right">FSV</TableHead>
                      <TableHead className="text-right">Haircut</TableHead>
                      <TableHead>Lien</TableHead>
                      <TableHead>Valuer</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {items.map(v => (
                      <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(v)}>
                        <TableCell className="font-mono text-xs font-medium">{v.id}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate">{v.owner}</TableCell>
                        <TableCell className="text-xs capitalize">{v.collateral_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right font-bold">{fmtB(v.market_value)}</TableCell>
                        <TableCell className="text-right text-blue-700">{fmtB(v.forced_sale_value)}</TableCell>
                        <TableCell className="text-right text-sm">{v.haircut_pct}%</TableCell>
                        <TableCell className="text-sm capitalize">{v.lien_status}</TableCell>
                        <TableCell className="text-sm">{v.valuer}</TableCell>
                        <TableCell className="text-sm">{v.expiry_date}</TableCell>
                        <TableCell>
                          <Badge variant={v.status === 'current' ? 'default' : v.status === 'expiring_soon' ? 'secondary' : 'destructive'}>
                            {v.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ValuationDetailSheet val={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
