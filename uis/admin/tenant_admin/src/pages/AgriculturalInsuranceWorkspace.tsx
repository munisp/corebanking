import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ShieldCheck, Plus, ChevronRight, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInsuranceProducts, useCreatePolicy, useInsuranceGuarantees } from '../hooks/useAgriculture';
import type { InsuranceProduct, CreatePolicyPayload } from '../types/agriculture';

const fmtM = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  return `₦${n.toLocaleString()}`;
};

const CROP_OPTIONS = ['maize', 'cassava', 'rice', 'yam', 'cocoa', 'palm_oil', 'sorghum', 'millet', 'wheat', 'soybean'];
const SEASON_OPTIONS = ['2025-wet', '2025-dry', '2026-wet', '2026-dry'];

function CreatePolicyDialog({ products, open, onClose }: { products: InsuranceProduct[]; open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreatePolicy();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreatePolicyPayload>({
    defaultValues: { farmer_id: '', product_id: '', crop_type: '', farm_location: '', farm_size_hectares: 0, coverage_amount: 0, season: '' },
  });

  function onSubmit(data: CreatePolicyPayload) {
    create(data, { onSuccess: () => { reset(); onClose(); } });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Insurance Policy</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Farmer ID <span className="text-destructive">*</span></Label>
              <Input {...register('farmer_id', { required: true })} placeholder="FARMER-001" />
              {errors.farmer_id && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Product <span className="text-destructive">*</span></Label>
              <select {...register('product_id', { required: true })} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Select product…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.product_id && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Crop Type <span className="text-destructive">*</span></Label>
              <select {...register('crop_type', { required: true })} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Select crop…</option>
                {CROP_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
              {errors.crop_type && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Season <span className="text-destructive">*</span></Label>
              <select {...register('season', { required: true })} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Select season…</option>
                {SEASON_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.season && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Farm Location <span className="text-destructive">*</span></Label>
              <Input {...register('farm_location', { required: true })} placeholder="Kano, Kano State" />
              {errors.farm_location && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Farm Size (ha) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.1" min={0.1} {...register('farm_size_hectares', { required: true, min: 0.1, valueAsNumber: true })} />
              {errors.farm_size_hectares && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Coverage Amount (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" min={1} {...register('coverage_amount', { required: true, min: 1, valueAsNumber: true })} />
              {errors.coverage_amount && <p className="text-xs text-destructive">Required</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Policy'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailSheet({ product, open, onClose }: { product: InsuranceProduct | null; open: boolean; onClose: () => void }) {
  if (!product) return null;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[460px] sm:max-w-[460px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-700" />
            {product.name}
          </SheetTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={product.is_active ? 'default' : 'secondary'}>{product.is_active ? 'Active' : 'Inactive'}</Badge>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 capitalize">{product.type.replace(/_/g, ' ')}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          {[
            ['Max Coverage', fmtM(product.max_coverage_amount)],
            ['Premium Rate', `${product.premium_rate_min}% – ${product.premium_rate_max}%`],
            ['Subsidy Available', product.subsidy_available ? `Yes (${product.subsidy_percent}%)` : 'No'],
            ['Subsidy Source', product.subsidy_source ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right">{v}</span>
            </div>
          ))}
          {product.eligible_crops && product.eligible_crops.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">Eligible Crops</p>
              <div className="flex flex-wrap gap-1">
                {product.eligible_crops.map(c => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 capitalize">{c.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
          )}
          {product.parametric_triggers && product.parametric_triggers.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">Parametric Triggers</p>
              {product.parametric_triggers.map((t, i) => (
                <div key={i} className="text-xs border rounded p-2 mb-1">
                  <span className="font-medium capitalize">{t.trigger_type.replace(/_/g, ' ')}</span>
                  {' — threshold: '}{t.threshold} {t.unit}
                  {' → '}{t.payout_percent}% payout
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AgriculturalInsuranceWorkspace() {
  const { data: productsData, isLoading: loadingProducts } = useInsuranceProducts();
  const { data: guaranteesData, isLoading: loadingGuarantees } = useInsuranceGuarantees();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InsuranceProduct | null>(null);

  const products = productsData?.products ?? [];
  const guarantees = guaranteesData?.guarantees ?? [];
  const activeProducts = products.filter(p => p.is_active).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-green-700" />
            Crop Insurance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Weather-indexed parametric insurance, policy creation, and portfolio guarantees
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Policy
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: productsData?.count ?? products.length },
          { label: 'Active Products', value: activeProducts },
          { label: 'Guarantee Programs', value: guarantees.length },
          { label: 'Total Guarantee Pool', value: guaranteesData ? fmtM(guaranteesData.total_available) : '—' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-bold mt-1">{String(c.value)}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Insurance Products</TabsTrigger>
          <TabsTrigger value="guarantees">Portfolio Guarantees</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Product Catalogue</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Max Coverage</TableHead>
                      <TableHead className="text-right">Premium Rate</TableHead>
                      <TableHead>Subsidy</TableHead>
                      <TableHead>Eligible Crops</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProducts && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {!loadingProducts && products.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No products found</TableCell></TableRow>}
                    {products.map(p => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedProduct(p)}>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 capitalize">{p.type.replace(/_/g, ' ')}</span>
                        </TableCell>
                        <TableCell className="text-right font-bold">{fmtM(p.max_coverage_amount)}</TableCell>
                        <TableCell className="text-right text-sm">{p.premium_rate_min}% – {p.premium_rate_max}%</TableCell>
                        <TableCell className="text-sm">
                          {p.subsidy_available
                            ? <span className="flex items-center gap-1 text-emerald-700"><Star className="w-3 h-3" />{p.subsidy_percent}%</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                          {p.eligible_crops?.slice(0, 3).join(', ') ?? '—'}
                          {(p.eligible_crops?.length ?? 0) > 3 && ` +${(p.eligible_crops?.length ?? 0) - 3}`}
                        </TableCell>
                        <TableCell><Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guarantees" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Portfolio Guarantee Programs</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingGuarantees && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {!loadingGuarantees && guarantees.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No guarantee programs found</TableCell></TableRow>}
                    {guarantees.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-mono text-xs">{g.id}</TableCell>
                        <TableCell className="font-medium text-sm">{g.program}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{fmtM(g.available_amount)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtM(g.used_amount)}</TableCell>
                        <TableCell className="text-sm">{g.currency}</TableCell>
                        <TableCell><Badge variant={g.status === 'active' ? 'default' : 'secondary'}>{g.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreatePolicyDialog products={products} open={createOpen} onClose={() => setCreateOpen(false)} />
      <ProductDetailSheet product={selectedProduct} open={!!selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
}
