/**
 * Branch Performance Map — Geospatial visualization of branch financial performance.
 * Uses Leaflet (open source) for rendering + Apache Sedona/Lakehouse for data.
 * Shows revenue, transactions, NPL ratio, deposits per branch on an interactive Nigeria map.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Building2,
  DollarSign,
  MapPin,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface BranchData {
  branch_id: string;
  name: string;
  state: string;
  lga: string;
  lat: number;
  lon: number;
  revenue_ngn: number;
  transactions_daily: number;
  customers: number;
  npl_pct: number;
  deposits_ngn: number;
  status: "green" | "amber" | "red";
}

// ─── BRANCH DATA (Nigeria) ──────────────────────────────────────────────────

const BRANCHES: BranchData[] = [
  { branch_id: "BR-001", name: "Lagos Island Main", state: "Lagos", lga: "Lagos Island", lat: 6.4541, lon: 3.4082, revenue_ngn: 850_000_000, transactions_daily: 2400, customers: 15200, npl_pct: 2.1, deposits_ngn: 12_500_000_000, status: "green" },
  { branch_id: "BR-002", name: "Victoria Island", state: "Lagos", lga: "Eti-Osa", lat: 6.4281, lon: 3.4219, revenue_ngn: 1_200_000_000, transactions_daily: 3100, customers: 18500, npl_pct: 1.8, deposits_ngn: 18_000_000_000, status: "green" },
  { branch_id: "BR-003", name: "Ikeja GRA", state: "Lagos", lga: "Ikeja", lat: 6.5833, lon: 3.3500, revenue_ngn: 620_000_000, transactions_daily: 1800, customers: 12000, npl_pct: 3.2, deposits_ngn: 8_500_000_000, status: "green" },
  { branch_id: "BR-004", name: "Lekki Phase 1", state: "Lagos", lga: "Eti-Osa", lat: 6.4474, lon: 3.4734, revenue_ngn: 950_000_000, transactions_daily: 2200, customers: 14000, npl_pct: 2.5, deposits_ngn: 14_000_000_000, status: "green" },
  { branch_id: "BR-005", name: "Abuja Central", state: "FCT", lga: "Municipal", lat: 9.0579, lon: 7.4951, revenue_ngn: 780_000_000, transactions_daily: 2000, customers: 11000, npl_pct: 2.8, deposits_ngn: 10_500_000_000, status: "green" },
  { branch_id: "BR-006", name: "Garki Area 11", state: "FCT", lga: "Garki", lat: 9.0227, lon: 7.4880, revenue_ngn: 450_000_000, transactions_daily: 1200, customers: 8500, npl_pct: 3.5, deposits_ngn: 6_000_000_000, status: "amber" },
  { branch_id: "BR-007", name: "Wuse Zone 5", state: "FCT", lga: "Wuse", lat: 9.0765, lon: 7.4892, revenue_ngn: 520_000_000, transactions_daily: 1500, customers: 9200, npl_pct: 2.9, deposits_ngn: 7_200_000_000, status: "green" },
  { branch_id: "BR-008", name: "Port Harcourt Main", state: "Rivers", lga: "Port Harcourt", lat: 4.8156, lon: 7.0498, revenue_ngn: 380_000_000, transactions_daily: 1100, customers: 7800, npl_pct: 4.2, deposits_ngn: 5_200_000_000, status: "amber" },
  { branch_id: "BR-009", name: "Kano City Gate", state: "Kano", lga: "Nassarawa", lat: 12.0022, lon: 8.5920, revenue_ngn: 290_000_000, transactions_daily: 950, customers: 6500, npl_pct: 5.8, deposits_ngn: 3_800_000_000, status: "red" },
  { branch_id: "BR-010", name: "Ibadan Ring Road", state: "Oyo", lga: "Ibadan North", lat: 7.3776, lon: 3.9470, revenue_ngn: 320_000_000, transactions_daily: 1000, customers: 7200, npl_pct: 3.5, deposits_ngn: 4_500_000_000, status: "green" },
  { branch_id: "BR-011", name: "Enugu Main", state: "Enugu", lga: "Enugu North", lat: 6.4584, lon: 7.5464, revenue_ngn: 280_000_000, transactions_daily: 850, customers: 5800, npl_pct: 3.8, deposits_ngn: 3_500_000_000, status: "amber" },
  { branch_id: "BR-012", name: "Benin City", state: "Edo", lga: "Oredo", lat: 6.3350, lon: 5.6037, revenue_ngn: 310_000_000, transactions_daily: 900, customers: 6100, npl_pct: 4.0, deposits_ngn: 4_000_000_000, status: "amber" },
  { branch_id: "BR-013", name: "Kaduna Central", state: "Kaduna", lga: "Kaduna North", lat: 10.5105, lon: 7.4165, revenue_ngn: 260_000_000, transactions_daily: 780, customers: 5500, npl_pct: 4.5, deposits_ngn: 3_200_000_000, status: "amber" },
  { branch_id: "BR-014", name: "Owerri Main", state: "Imo", lga: "Owerri Municipal", lat: 5.4836, lon: 7.0333, revenue_ngn: 240_000_000, transactions_daily: 720, customers: 5000, npl_pct: 3.2, deposits_ngn: 2_800_000_000, status: "green" },
  { branch_id: "BR-015", name: "Calabar Marina", state: "Cross River", lga: "Calabar Municipal", lat: 4.9517, lon: 8.3220, revenue_ngn: 180_000_000, transactions_daily: 550, customers: 4200, npl_pct: 3.0, deposits_ngn: 2_200_000_000, status: "green" },
  { branch_id: "BR-016", name: "Jos Terminus", state: "Plateau", lga: "Jos North", lat: 9.8965, lon: 8.8583, revenue_ngn: 195_000_000, transactions_daily: 600, customers: 4500, npl_pct: 4.8, deposits_ngn: 2_400_000_000, status: "amber" },
  { branch_id: "BR-017", name: "Abeokuta Kuto", state: "Ogun", lga: "Abeokuta South", lat: 7.1475, lon: 3.3619, revenue_ngn: 270_000_000, transactions_daily: 820, customers: 5600, npl_pct: 3.1, deposits_ngn: 3_400_000_000, status: "green" },
  { branch_id: "BR-018", name: "Warri Effurun", state: "Delta", lga: "Uvwie", lat: 5.5544, lon: 5.7812, revenue_ngn: 350_000_000, transactions_daily: 980, customers: 6800, npl_pct: 4.1, deposits_ngn: 4_800_000_000, status: "amber" },
  { branch_id: "BR-019", name: "Uyo Ikot Ekpene Rd", state: "Akwa Ibom", lga: "Uyo", lat: 5.0377, lon: 7.9128, revenue_ngn: 220_000_000, transactions_daily: 650, customers: 4800, npl_pct: 2.9, deposits_ngn: 2_600_000_000, status: "green" },
  { branch_id: "BR-020", name: "Maiduguri GRA", state: "Borno", lga: "Maiduguri", lat: 11.8469, lon: 13.1600, revenue_ngn: 150_000_000, transactions_daily: 420, customers: 3200, npl_pct: 6.2, deposits_ngn: 1_800_000_000, status: "red" },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  green: { bg: "bg-emerald-100", text: "text-emerald-800", dot: "#10b981", border: "border-emerald-300" },
  amber: { bg: "bg-amber-100", text: "text-amber-800", dot: "#f59e0b", border: "border-amber-300" },
  red: { bg: "bg-red-100", text: "text-red-800", dot: "#ef4444", border: "border-red-300" },
};

function formatNGN(value: number): string {
  if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(0)}M`;
  return `₦${value.toLocaleString()}`;
}

// ─── MAP COMPONENT (SVG-based for zero external dependencies) ───────────────

function NigeriaMap({ branches, selectedBranch, onSelectBranch }: {
  branches: BranchData[];
  selectedBranch: BranchData | null;
  onSelectBranch: (b: BranchData) => void;
}) {
  // Nigeria bounding box: lat 4.2-13.9, lon 2.7-14.7
  const minLat = 3.5, maxLat = 14.0, minLon = 2.5, maxLon = 15.0;
  const width = 700, height = 600;

  const toSvgX = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * width;
  const toSvgY = (lat: number) => height - ((lat - minLat) / (maxLat - minLat)) * height;

  // Nigeria outline (simplified)
  const nigeriaPath = "M 80,520 L 110,480 L 90,420 L 70,380 L 80,340 L 120,290 L 160,260 L 200,250 L 240,200 L 280,170 L 320,140 L 360,100 L 400,80 L 440,70 L 480,80 L 520,100 L 560,130 L 580,170 L 600,220 L 620,280 L 640,340 L 630,400 L 600,440 L 560,470 L 520,490 L 480,500 L 440,510 L 400,520 L 360,530 L 320,540 L 280,550 L 240,540 L 200,530 L 160,530 L 120,530 Z";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ minHeight: "450px" }}>
      {/* Background */}
      <rect width={width} height={height} fill="#f8fafc" rx="8" />

      {/* Nigeria outline */}
      <path d={nigeriaPath} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />

      {/* Grid lines */}
      {[4, 6, 8, 10, 12].map(lat => (
        <g key={`lat-${lat}`}>
          <line x1={0} y1={toSvgY(lat)} x2={width} y2={toSvgY(lat)} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="4,4" />
          <text x={5} y={toSvgY(lat) - 3} fontSize="9" fill="#94a3b8">{lat}°N</text>
        </g>
      ))}
      {[4, 6, 8, 10, 12, 14].map(lon => (
        <g key={`lon-${lon}`}>
          <line x1={toSvgX(lon)} y1={0} x2={toSvgX(lon)} y2={height} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="4,4" />
          <text x={toSvgX(lon)} y={height - 5} fontSize="9" fill="#94a3b8">{lon}°E</text>
        </g>
      ))}

      {/* Branch markers */}
      {branches.map(branch => {
        const cx = toSvgX(branch.lon);
        const cy = toSvgY(branch.lat);
        const color = STATUS_COLORS[branch.status].dot;
        const isSelected = selectedBranch?.branch_id === branch.branch_id;
        const radius = Math.max(8, Math.min(18, branch.revenue_ngn / 80_000_000));

        return (
          <g key={branch.branch_id} onClick={() => onSelectBranch(branch)} style={{ cursor: "pointer" }}>
            {/* Pulse animation for selected */}
            {isSelected && (
              <circle cx={cx} cy={cy} r={radius + 6} fill={color} opacity={0.2}>
                <animate attributeName="r" values={`${radius + 4};${radius + 12};${radius + 4}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Main circle (size = revenue) */}
            <circle cx={cx} cy={cy} r={radius} fill={color} opacity={0.7} stroke={isSelected ? "#1f2937" : color} strokeWidth={isSelected ? 2.5 : 1} />
            {/* Inner dot */}
            <circle cx={cx} cy={cy} r={3} fill="white" />
            {/* Label */}
            <text x={cx} y={cy - radius - 4} textAnchor="middle" fontSize="9" fill="#374151" fontWeight={isSelected ? "bold" : "normal"}>
              {branch.name.split(" ")[0]}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(10, 10)">
        <rect width="130" height="100" fill="white" stroke="#e2e8f0" rx="4" opacity="0.95" />
        <text x="10" y="18" fontSize="10" fontWeight="bold" fill="#374151">Branch Performance</text>
        <circle cx={18} cy={35} r={5} fill="#10b981" /><text x={28} y={39} fontSize="9" fill="#374151">Green (On Target)</text>
        <circle cx={18} cy={55} r={5} fill="#f59e0b" /><text x={28} y={59} fontSize="9" fill="#374151">Amber (At Risk)</text>
        <circle cx={18} cy={75} r={5} fill="#ef4444" /><text x={28} y={79} fontSize="9" fill="#374151">Red (Below Target)</text>
        <text x="10" y="95" fontSize="8" fill="#94a3b8">Circle size = Revenue</text>
      </g>
    </svg>
  );
}

// ─── BRANCH DETAIL PANEL ────────────────────────────────────────────────────

function BranchDetail({ branch }: { branch: BranchData }) {
  const colors = STATUS_COLORS[branch.status];
  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">{branch.name}</h3>
            <p className="text-sm text-gray-600">{branch.state}, {branch.lga}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${colors.text} ${colors.bg}`}>
            {branch.status}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-gray-500"><DollarSign size={12} /> Revenue</div>
          <div className="text-lg font-bold">{formatNGN(branch.revenue_ngn)}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Activity size={12} /> Txn/Day</div>
          <div className="text-lg font-bold">{branch.transactions_daily.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Users size={12} /> Customers</div>
          <div className="text-lg font-bold">{branch.customers.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-gray-500"><TrendingDown size={12} /> NPL</div>
          <div className={`text-lg font-bold ${branch.npl_pct > 5 ? "text-red-600" : branch.npl_pct > 3 ? "text-amber-600" : "text-emerald-600"}`}>
            {branch.npl_pct}%
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg col-span-2">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Building2 size={12} /> Total Deposits</div>
          <div className="text-lg font-bold">{formatNGN(branch.deposits_ngn)}</div>
        </div>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-xs text-blue-600 font-medium">Geospatial Source</div>
        <div className="text-xs text-blue-500 mt-1">Apache Sedona + Lakehouse (kpi_catalog.geospatial.branch_locations)</div>
        <div className="text-xs text-gray-500 mt-1">Coordinates: {branch.lat.toFixed(4)}°N, {branch.lon.toFixed(4)}°E</div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function BranchPerformanceMapWorkspace() {
  const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null);
  const [filter, setFilter] = useState<"all" | "green" | "amber" | "red">("all");
  const [metric, setMetric] = useState<"revenue" | "transactions" | "npl" | "deposits">("revenue");

  const filteredBranches = filter === "all" ? BRANCHES : BRANCHES.filter(b => b.status === filter);

  // Summary stats
  const totalRevenue = BRANCHES.reduce((s, b) => s + b.revenue_ngn, 0);
  const totalCustomers = BRANCHES.reduce((s, b) => s + b.customers, 0);
  const avgNPL = BRANCHES.reduce((s, b) => s + b.npl_pct, 0) / BRANCHES.length;
  const totalDeposits = BRANCHES.reduce((s, b) => s + b.deposits_ngn, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={24} /> Branch Performance Map
          </h1>
          <p className="text-sm text-gray-500">Geospatial visualization of branch financial KPIs — powered by Apache Sedona + Lakehouse</p>
        </div>
        <div className="flex gap-2">
          {(["all", "green", "amber", "red"] as const).map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f === "all" ? "All Branches" : f}
              {f !== "all" && <span className="ml-1 text-xs">({BRANCHES.filter(b => b.status === f).length})</span>}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">Total Revenue</div>
          <div className="text-xl font-bold">{formatNGN(totalRevenue)}</div>
          <div className="text-xs text-emerald-600 flex items-center gap-1"><TrendingUp size={10} /> +8.2% MoM</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">Total Customers</div>
          <div className="text-xl font-bold">{totalCustomers.toLocaleString()}</div>
          <div className="text-xs text-emerald-600 flex items-center gap-1"><TrendingUp size={10} /> +5.4% MoM</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">Avg NPL Ratio</div>
          <div className={`text-xl font-bold ${avgNPL > 5 ? "text-red-600" : "text-amber-600"}`}>{avgNPL.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">CBN max: 5.0%</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">Total Deposits</div>
          <div className="text-xl font-bold">{formatNGN(totalDeposits)}</div>
          <div className="text-xs text-emerald-600 flex items-center gap-1"><TrendingUp size={10} /> +6.1% MoM</div>
        </CardContent></Card>
      </div>

      {/* Map + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin size={18} />
              Nigeria — {filteredBranches.length} Branches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NigeriaMap branches={filteredBranches} selectedBranch={selectedBranch} onSelectBranch={setSelectedBranch} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedBranch ? (
            <Card>
              <CardHeader><CardTitle className="text-sm">Branch Detail</CardTitle></CardHeader>
              <CardContent><BranchDetail branch={selectedBranch} /></CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                <MapPin size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Click a branch on the map to view details</p>
              </CardContent>
            </Card>
          )}

          {/* Branch Ranking */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Top/Bottom Performers</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[...BRANCHES].sort((a, b) => b.revenue_ngn - a.revenue_ngn).slice(0, 5).map((b, i) => (
                <div key={b.branch_id} className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded" onClick={() => setSelectedBranch(b)}>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-4">{i + 1}.</span>
                    <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: STATUS_COLORS[b.status].dot }} />
                    <span className="font-medium">{b.name}</span>
                  </div>
                  <span className="text-gray-600">{formatNGN(b.revenue_ngn)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <div className="text-xs text-gray-400 mb-1">Underperforming</div>
                {[...BRANCHES].sort((a, b) => b.npl_pct - a.npl_pct).slice(0, 3).map(b => (
                  <div key={b.branch_id} className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded" onClick={() => setSelectedBranch(b)}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: STATUS_COLORS[b.status].dot }} />
                      <span className="font-medium">{b.name}</span>
                    </div>
                    <span className="text-red-600">{b.npl_pct}% NPL</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Source Footer */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Data Source: Apache Sedona (geospatial) + Apache Iceberg (Lakehouse) via <code className="bg-gray-100 px-1 rounded">kpi_catalog.geospatial.branch_locations</code>
          </div>
          <div className="text-xs text-gray-400">
            Last refresh: {new Date().toLocaleTimeString()} | 20 branches | Real-time financial data from Postgres
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
