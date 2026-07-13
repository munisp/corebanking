import { useState } from 'react';
import { TrendingUp, Search, Trophy, Users, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useFarmerDashboard,
  useCooperativeDashboard,
  useAchievements,
  useFarmerCreditHistory,
} from '../hooks/useAgriculture';

const fmtM = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  return `₦${n.toLocaleString()}`;
};

function FarmerLookup() {
  const [input, setInput] = useState('');
  const [farmerId, setFarmerId] = useState('');

  const { data: dashData, isLoading: loadingDash } = useFarmerDashboard(farmerId);
  const { data: creditData, isLoading: loadingCredit } = useFarmerCreditHistory(farmerId);
  const { data: achievementsData, isLoading: loadingAchievements } = useAchievements(farmerId);

  const dashboard = dashData?.dashboard ?? null;
  const credit = creditData ?? null;
  const achievements = achievementsData?.achievements ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Enter Farmer ID…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setFarmerId(input.trim())}
          />
        </div>
        <Button onClick={() => setFarmerId(input.trim())} disabled={!input.trim()}>
          <Search className="w-4 h-4 mr-1" /> Lookup
        </Button>
      </div>

      {!farmerId && (
        <p className="text-sm text-muted-foreground py-8 text-center">Enter a farmer ID to view their impact dashboard and credit history.</p>
      )}

      {farmerId && (
        <div className="space-y-4">
          {(loadingDash || loadingCredit) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Credit Score', value: dashboard.credit_score },
                  { label: 'Total Financed', value: fmtM(dashboard.total_financed) },
                  { label: 'Seasons Supported', value: dashboard.seasons_supported },
                  { label: 'Next Season Eligible', value: dashboard.next_season_eligible ? 'Yes' : 'No' },
                ].map(c => (
                  <Card key={c.label}><CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-xl font-bold mt-1">{String(c.value)}</p>
                  </CardContent></Card>
                ))}
              </div>

              {dashboard.yield_improvement != null && (
                <div className="flex gap-4">
                  {dashboard.yield_improvement != null && (
                    <Card className="flex-1"><CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Yield Improvement</p>
                      <p className="text-xl font-bold mt-1 text-emerald-700">+{dashboard.yield_improvement}%</p>
                    </CardContent></Card>
                  )}
                  {dashboard.income_growth != null && (
                    <Card className="flex-1"><CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Income Growth</p>
                      <p className="text-xl font-bold mt-1 text-emerald-700">+{dashboard.income_growth}%</p>
                    </CardContent></Card>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No dashboard data found for {farmerId}.</p>
          )}

          {credit && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Credit History</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  {[
                    { label: 'Seasons', value: credit.total_seasons_financed },
                    { label: 'On Time', value: credit.on_time_repayments },
                    { label: 'Late', value: credit.late_repayments },
                    { label: 'Defaults', value: credit.defaults },
                    { label: 'Streak', value: credit.repayment_streak },
                    { label: 'Credit Limit', value: fmtM(credit.credit_limit) },
                  ].map(c => (
                    <div key={c.label} className="text-center">
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="font-bold text-sm mt-1">{c.value}</p>
                    </div>
                  ))}
                </div>
                {credit.season_history.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Season</TableHead>
                          <TableHead>Crop</TableHead>
                          <TableHead className="text-right">Loan</TableHead>
                          <TableHead className="text-right">Repaid</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {credit.season_history.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{s.season}</TableCell>
                            <TableCell className="text-sm capitalize">{s.crop_type?.replace(/_/g, ' ') ?? '—'}</TableCell>
                            <TableCell className="text-right text-sm">{fmtM(s.loan_amount)}</TableCell>
                            <TableCell className="text-right text-sm">{fmtM(s.repaid_amount)}</TableCell>
                            <TableCell>
                              <Badge variant={s.on_time ? 'default' : 'destructive'}>{s.on_time ? 'On Time' : 'Late'}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!loadingAchievements && achievements.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" />Achievements</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {achievements.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Trophy className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.description}</p>
                        {a.earned_at && <p className="text-xs text-muted-foreground mt-1">{a.earned_at}</p>}
                        {a.points != null && <p className="text-xs font-medium text-amber-600 mt-1">{a.points} pts</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CooperativeLookup() {
  const [input, setInput] = useState('');
  const [coopId, setCoopId] = useState('');

  const { data, isLoading } = useCooperativeDashboard(coopId);
  const dashboard = data?.dashboard ?? null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Enter Cooperative ID…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setCoopId(input.trim())}
          />
        </div>
        <Button onClick={() => setCoopId(input.trim())} disabled={!input.trim()}>
          <Search className="w-4 h-4 mr-1" /> Lookup
        </Button>
      </div>

      {!coopId && (
        <p className="text-sm text-muted-foreground py-8 text-center">Enter a cooperative ID to view their impact dashboard.</p>
      )}

      {coopId && isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}

      {coopId && !isLoading && dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total Members', value: dashboard.total_members },
            { label: 'Active Loans', value: dashboard.active_loans },
            { label: 'Total Disbursed', value: fmtM(dashboard.total_disbursed) },
            { label: 'Repayment Rate', value: `${(dashboard.repayment_rate * 100).toFixed(1)}%` },
            { label: 'Avg Credit Score', value: dashboard.avg_credit_score ?? '—' },
          ].map(c => (
            <Card key={c.label}><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold mt-1">{String(c.value)}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      {coopId && !isLoading && !dashboard && (
        <p className="text-sm text-muted-foreground text-center py-4">No dashboard data found for {coopId}.</p>
      )}
    </div>
  );
}

export default function FarmerImpactWorkspace() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-700" />
          Farmer Impact Dashboards
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Individual farmer impact, credit history, achievements, and cooperative portfolio analytics
        </p>
      </div>

      <Tabs defaultValue="farmer">
        <TabsList>
          <TabsTrigger value="farmer"><User className="w-4 h-4 mr-1" />Farmer Lookup</TabsTrigger>
          <TabsTrigger value="cooperative"><Users className="w-4 h-4 mr-1" />Cooperative Lookup</TabsTrigger>
        </TabsList>
        <TabsContent value="farmer" className="mt-4">
          <FarmerLookup />
        </TabsContent>
        <TabsContent value="cooperative" className="mt-4">
          <CooperativeLookup />
        </TabsContent>
      </Tabs>
    </div>
  );
}
