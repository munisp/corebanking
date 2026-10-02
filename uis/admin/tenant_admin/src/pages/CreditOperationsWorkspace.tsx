/**
 * Credit Operations Workspace — W12 A4-P1-A
 *
 * Wires the previously-orphaned credit-service routes (gateway prefix /credit):
 *   GET  /v1/scores                            — risk assessments
 *   GET  /v1/multicurrency/revaluation         — revaluation positions
 *   POST /v1/multicurrency/run                 — run revaluation
 *   GET/POST /v1/otc/derivatives, GET /v1/otc/stats
 *   GET  /v1/etd/trades, GET /v1/etd/stats
 *   GET/POST /v1/banking-clearing-ops/instructions, GET /v1/banking-clearing-ops/stats
 */
import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, Play, Plus, RefreshCcw, Scale } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  creditServiceOpsApi,
  type CreditRiskAssessment,
  type MulticurrencyRevaluation,
  type OtcDerivative,
  type ClearingInstruction,
} from "@/api/creditRiskApi";

type TabKey = "scores" | "revaluation" | "otc" | "etd" | "clearing";

const TABS: { key: TabKey; label: string }[] = [
  { key: "scores", label: "Risk Scores" },
  { key: "revaluation", label: "FX Revaluation" },
  { key: "otc", label: "OTC Derivatives" },
  { key: "etd", label: "ETD Trades" },
  { key: "clearing", label: "Clearing Instructions" },
];

function GenericTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: { key: string; label: string }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No records.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {columns.map((c) => (
              <th key={c.key} className="px-2 py-1.5 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)} className="border-b last:border-0">
              {columns.map((c) => (
                <td key={c.key} className="px-2 py-1.5">
                  {c.key === "status" ? (
                    <Badge variant="outline">{String(r[c.key] ?? "—")}</Badge>
                  ) : (
                    <span className={typeof r[c.key] === "number" ? "tabular-nums" : ""}>
                      {r[c.key] === null || r[c.key] === undefined ? "—" : String(r[c.key])}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CreditOperationsWorkspace() {
  const [tab, setTab] = useState<TabKey>("scores");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [scores, setScores] = useState<CreditRiskAssessment[]>([]);
  const [reval, setReval] = useState<MulticurrencyRevaluation[]>([]);
  const [otc, setOtc] = useState<OtcDerivative[]>([]);
  const [etd, setEtd] = useState<Record<string, unknown>[]>([]);
  const [clearing, setClearing] = useState<ClearingInstruction[]>([]);
  const [stats, setStats] = useState<{ otc?: unknown; etd?: unknown; clearing?: unknown }>({});

  const [otcForm, setOtcForm] = useState({ instrument_type: "swap", counterparty: "", notional: "", currency: "NGN", strike_rate: "", maturity_date: "" });
  const [clearingForm, setClearingForm] = useState({ reference: "", amount: "", currency: "NGN", debtor_account: "", creditor_account: "", clearing_house: "NIBSS", settlement_date: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r, o, e, c, otcS, etdS, clrS] = await Promise.all([
        creditServiceOpsApi.listScores().catch(() => ({ items: [], total: 0 })),
        creditServiceOpsApi.getRevaluation().catch(() => ({ items: [], total: 0 })),
        creditServiceOpsApi.listOtcDerivatives().catch(() => ({ items: [], total: 0 })),
        creditServiceOpsApi.listEtdTrades().catch(() => ({ items: [], total: 0 })),
        creditServiceOpsApi.listClearingInstructions().catch(() => ({ items: [], total: 0 })),
        creditServiceOpsApi.otcStats().catch(() => null),
        creditServiceOpsApi.etdStats().catch(() => null),
        creditServiceOpsApi.clearingStats().catch(() => null),
      ]);
      setScores(s.items ?? []);
      setReval(r.items ?? []);
      setOtc(o.items ?? []);
      setEtd((e.items ?? []) as Record<string, unknown>[]);
      setClearing(c.items ?? []);
      setStats({ otc: otcS, etd: etdS, clearing: clrS });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load credit operations data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(key: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(successMsg);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6 text-emerald-700" />
          <div>
            <h1 className="text-xl font-semibold">Credit Operations</h1>
            <p className="text-sm text-muted-foreground">
              Risk scores, FX revaluation, derivatives and clearing instructions (credit-service)
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Separator />

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "outline"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {tab === "scores" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Risk Assessments ({scores.length})</CardTitle></CardHeader>
              <CardContent>
                <GenericTable
                  rows={scores as unknown as Record<string, unknown>[]}
                  columns={[
                    { key: "entity_name", label: "Entity" },
                    { key: "entity_type", label: "Type" },
                    { key: "risk_type", label: "Risk" },
                    { key: "pd", label: "PD" },
                    { key: "lgd", label: "LGD" },
                    { key: "expected_loss", label: "Expected Loss" },
                    { key: "rating", label: "Rating" },
                    { key: "ifrs9_stage", label: "IFRS9" },
                    { key: "status", label: "Status" },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          {tab === "revaluation" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Multicurrency Revaluation ({reval.length})</CardTitle>
                <Button size="sm" disabled={busy !== null}
                  onClick={() => void runAction("reval-run", () => creditServiceOpsApi.runRevaluation(), "Revaluation run completed")}>
                  <Play className="h-4 w-4 mr-1" /> {busy === "reval-run" ? "Running…" : "Run revaluation"}
                </Button>
              </CardHeader>
              <CardContent>
                <GenericTable
                  rows={reval as unknown as Record<string, unknown>[]}
                  columns={[
                    { key: "account_id", label: "Account" },
                    { key: "currency", label: "Ccy" },
                    { key: "book_rate", label: "Book Rate" },
                    { key: "market_rate", label: "Market Rate" },
                    { key: "book_value", label: "Book Value" },
                    { key: "market_value", label: "Market Value" },
                    { key: "unrealized_pnl", label: "Unrealized P&L" },
                    { key: "status", label: "Status" },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          {tab === "otc" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">OTC Derivatives ({otc.length})</CardTitle>
                {stats.otc != null && <Badge variant="outline">{JSON.stringify(stats.otc)}</Badge>}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/30 p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Instrument</Label>
                    <Input className="w-28" value={otcForm.instrument_type} onChange={(e) => setOtcForm((f) => ({ ...f, instrument_type: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Counterparty *</Label>
                    <Input className="w-40" value={otcForm.counterparty} onChange={(e) => setOtcForm((f) => ({ ...f, counterparty: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notional *</Label>
                    <Input className="w-32" type="number" min="0" value={otcForm.notional} onChange={(e) => setOtcForm((f) => ({ ...f, notional: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Strike Rate</Label>
                    <Input className="w-28" type="number" step="0.0001" value={otcForm.strike_rate} onChange={(e) => setOtcForm((f) => ({ ...f, strike_rate: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Maturity</Label>
                    <Input className="w-36" type="date" value={otcForm.maturity_date} onChange={(e) => setOtcForm((f) => ({ ...f, maturity_date: e.target.value }))} />
                  </div>
                  <Button size="sm" disabled={busy !== null || !otcForm.counterparty || !otcForm.notional}
                    onClick={() => void runAction("otc-create", () => creditServiceOpsApi.createOtcDerivative({
                      instrument_type: otcForm.instrument_type,
                      counterparty: otcForm.counterparty,
                      notional: Number(otcForm.notional),
                      currency: otcForm.currency,
                      strike_rate: otcForm.strike_rate ? Number(otcForm.strike_rate) : undefined,
                      maturity_date: otcForm.maturity_date || undefined,
                    }), "Derivative booked")}>
                    <Plus className="h-4 w-4 mr-1" /> Book derivative
                  </Button>
                </div>
                <GenericTable
                  rows={otc as unknown as Record<string, unknown>[]}
                  columns={[
                    { key: "instrument_type", label: "Instrument" },
                    { key: "counterparty", label: "Counterparty" },
                    { key: "notional", label: "Notional" },
                    { key: "currency", label: "Ccy" },
                    { key: "strike_rate", label: "Strike" },
                    { key: "mtm_value", label: "MTM" },
                    { key: "maturity_date", label: "Maturity" },
                    { key: "status", label: "Status" },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          {tab === "etd" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Exchange-Traded Derivatives ({etd.length})</CardTitle>
                {stats.etd != null && <Badge variant="outline">{JSON.stringify(stats.etd)}</Badge>}
              </CardHeader>
              <CardContent>
                <GenericTable
                  rows={etd}
                  columns={[
                    { key: "symbol", label: "Symbol" },
                    { key: "side", label: "Side" },
                    { key: "quantity", label: "Qty" },
                    { key: "price", label: "Price" },
                    { key: "mtm_value", label: "MTM" },
                    { key: "status", label: "Status" },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          {tab === "clearing" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Clearing Instructions ({clearing.length})</CardTitle>
                {stats.clearing != null && <Badge variant="outline">{JSON.stringify(stats.clearing)}</Badge>}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/30 p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Reference *</Label>
                    <Input className="w-36" value={clearingForm.reference} onChange={(e) => setClearingForm((f) => ({ ...f, reference: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount *</Label>
                    <Input className="w-32" type="number" min="0" value={clearingForm.amount} onChange={(e) => setClearingForm((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Debtor Acct</Label>
                    <Input className="w-36" value={clearingForm.debtor_account} onChange={(e) => setClearingForm((f) => ({ ...f, debtor_account: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Creditor Acct</Label>
                    <Input className="w-36" value={clearingForm.creditor_account} onChange={(e) => setClearingForm((f) => ({ ...f, creditor_account: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Clearing House</Label>
                    <Input className="w-28" value={clearingForm.clearing_house} onChange={(e) => setClearingForm((f) => ({ ...f, clearing_house: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Value Date</Label>
                    <Input className="w-36" type="date" value={clearingForm.settlement_date} onChange={(e) => setClearingForm((f) => ({ ...f, settlement_date: e.target.value }))} />
                  </div>
                  <Button size="sm" disabled={busy !== null || !clearingForm.reference || !clearingForm.amount}
                    onClick={() => void runAction("clr-create", () => creditServiceOpsApi.createClearingInstruction({
                      reference: clearingForm.reference,
                      amount: Number(clearingForm.amount),
                      currency: clearingForm.currency,
                      debtor_account: clearingForm.debtor_account || undefined,
                      creditor_account: clearingForm.creditor_account || undefined,
                      clearing_house: clearingForm.clearing_house || undefined,
                      settlement_date: clearingForm.settlement_date || undefined,
                    }), "Instruction created")}>
                    <Plus className="h-4 w-4 mr-1" /> New instruction
                  </Button>
                </div>
                <GenericTable
                  rows={clearing as unknown as Record<string, unknown>[]}
                  columns={[
                    { key: "type", label: "Type" },
                    { key: "reference", label: "Reference" },
                    { key: "amount", label: "Amount" },
                    { key: "currency", label: "Ccy" },
                    { key: "debtor_account", label: "Debtor" },
                    { key: "creditor_account", label: "Creditor" },
                    { key: "clearing_house", label: "House" },
                    { key: "settlement_date", label: "Value Date" },
                    { key: "status", label: "Status" },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            Data served live by credit-service via APISIX prefix /credit.
          </div>
        </>
      )}
    </div>
  );
}
