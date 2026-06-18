import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  AlertCircle,
  RefreshCcw,
  TrendingDown,
  DollarSign,
  Layers,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fixedAssetsApi, type FixedAsset } from "@/api/financeApi";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const DEPRECIATION_LABELS: Record<string, string> = {
  straight_line:   "Straight Line",
  reducing_balance: "Reducing Balance",
  units_of_production: "Units of Production",
};

const STATUS_COLORS: Record<string, string> = {
  in_use:    "bg-green-100 text-green-800",
  disposed:  "bg-red-100 text-red-800",
  idle:      "bg-yellow-100 text-yellow-800",
  under_maintenance: "bg-orange-100 text-orange-800",
};

export default function FixedAssetsWorkspace() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: listData, isLoading: listLoading, error: listError, refetch } = useQuery({
    queryKey: ["fixed-assets", "list"],
    queryFn: () => fixedAssetsApi.list(),
    retry: 1,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["fixed-assets", "stats"],
    queryFn: () => fixedAssetsApi.stats(),
    retry: 1,
  });

  const assets: FixedAsset[] = listData?.items ?? [];

  const categories = [...new Set(assets.map((a) => a.category))];

  const filtered = assets.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      a.asset_name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q);
    const matchCategory = categoryFilter === "all" || a.category === categoryFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  const depreciationRate = statsData
    ? ((statsData.total_purchase_value - statsData.total_nbv) / statsData.total_purchase_value) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        <PageHeader
          label="Finance & Accounting"
          title="Fixed Assets"
          description="Asset register, depreciation tracking, and net book value — /fixed-assets/v1/fixed-assets-go/*"
          icon={<Building2 className="w-8 h-8" />}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))
            : (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Total Assets</span>
                      <Layers className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold">{statsData?.total_assets ?? assets.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Registered assets</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Purchase Value</span>
                      <DollarSign className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-xl font-bold">{fmt(statsData?.total_purchase_value ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total cost of assets</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Net Book Value</span>
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-xl font-bold text-orange-700">{fmt(statsData?.total_nbv ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">After depreciation</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Depreciation</span>
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    </div>
                    <p className="text-2xl font-bold text-red-700">{depreciationRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Total accumulated</p>
                  </CardContent>
                </Card>
              </>
            )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder="Search assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                  <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {listError ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <AlertCircle className="w-8 h-8" />
                <p className="font-medium">Failed to load fixed assets</p>
                <p className="text-xs">GET /fixed-assets/v1/fixed-assets-go/list</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : listLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Building2 className="w-8 h-8" />
                <p className="font-medium">No assets found</p>
                {search || categoryFilter !== "all" || statusFilter !== "all"
                  ? <p className="text-sm">Try adjusting your filters</p>
                  : <p className="text-sm">Fixed assets will appear here once registered</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset ID</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Depreciation</TableHead>
                      <TableHead className="text-right">Purchase Value</TableHead>
                      <TableHead className="text-right">Net Book Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono text-sm font-semibold">{asset.id}</TableCell>
                        <TableCell className="font-medium">{asset.asset_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{asset.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{asset.location}</TableCell>
                        <TableCell className="text-sm">{DEPRECIATION_LABELS[asset.depreciation_method] ?? asset.depreciation_method}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(asset.purchase_value)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-orange-700">{fmt(asset.net_book_value)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[asset.status] ?? "bg-muted text-muted-foreground"}`}>
                            {asset.status.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
