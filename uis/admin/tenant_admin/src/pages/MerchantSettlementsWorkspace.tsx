/**
 * Merchant Settlements Workspace — W12 A4-P1-A
 *
 * Wires the previously-orphaned merchant-service settlement family
 * (gateway prefix /merchant → services/merchant-service/merchant_settlement.py):
 *   POST /{mid}/settlements/calculate | create | {sid}/process | {sid}/adjust
 *   GET  /{mid}/settlements | /{sid} | /config   POST /{mid}/settlements/config
 */
import { useCallback, useEffect, useState } from "react";
import { Calculator, Landmark, Loader2, Play, Plus, RefreshCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  merchantSettlementsApi,
  type MerchantSettlement,
  type MerchantSettlementConfig,
  type MerchantSummary,
} from "@/api/merchantSettlementsApi";

function asArray<T>(data: T[] | { items?: T[] } | null | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

export default function MerchantSettlementsWorkspace() {
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [merchantId, setMerchantId] = useState("");
  const [settlements, setSettlements] = useState<MerchantSettlement[]>([]);
  const [config, setConfig] = useState<MerchantSettlementConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [period, setPeriod] = useState({ start: "", end: "" });
  const [bank, setBank] = useState({ account_number: "", bank_code: "", account_name: "" });
  const [adjustForm, setAdjustForm] = useState<Record<string, { type: string; amount: string; reason: string }>>({});
  const [configForm, setConfigForm] = useState({ settlement_frequency: "daily", minimum_settlement_amount: "", auto_settlement: "true" });

  useEffect(() => {
    (async () => {
      try {
        const list = asArray<MerchantSummary>(await merchantSettlementsApi.listMerchants({ limit: 200 }));
        setMerchants(list);
        if (list.length > 0) setMerchantId((cur) => cur || String(list[0].merchant_id));
      } catch {
        setError("Unable to load merchants from merchant-service.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadSettlements = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([
        merchantSettlementsApi.listSettlements(merchantId, { limit: 100 }).catch(() => [] as MerchantSettlement[]),
        merchantSettlementsApi.getConfig(merchantId).catch(() => null),
      ]);
      setSettlements(asArray<MerchantSettlement>(s));
      setConfig(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settlements");
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  async function runAction(key: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(successMsg);
      await loadSettlements();
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? (e instanceof Error ? e.message : "Action failed");
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setBusy(null);
    }
  }

  const periodValid = period.start && period.end;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-emerald-700" />
          <div>
            <h1 className="text-xl font-semibold">Merchant Settlements</h1>
            <p className="text-sm text-muted-foreground">
              Calculate, create, process and adjust merchant settlement payouts (merchant-service)
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadSettlements()} disabled={loading || !merchantId}>
          <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Separator />

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader><CardTitle className="text-base">Merchant</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-64">
            <Label className="text-xs">Select merchant</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
            >
              {merchants.length === 0 && <option value="">— enter merchant ID below —</option>}
              {merchants.map((m) => (
                <option key={m.merchant_id} value={m.merchant_id}>
                  {m.business_name ? `${m.business_name} (${m.merchant_id})` : m.merchant_id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">or Merchant ID</Label>
            <Input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} placeholder="MER-…" className="w-52" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">New Settlement Cycle</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Period start *</Label>
              <Input type="date" value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Period end *</Label>
              <Input type="date" value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} />
            </div>
            <Button size="sm" variant="outline" disabled={!merchantId || !periodValid || busy !== null}
              onClick={() => void runAction("calc", () => merchantSettlementsApi.calculateSettlement(merchantId, period.start, period.end), "Settlement calculated")}>
              <Calculator className="h-4 w-4 mr-1" /> Calculate
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Bank account *</Label>
              <Input className="w-40" value={bank.account_number} onChange={(e) => setBank((b) => ({ ...b, account_number: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bank code *</Label>
              <Input className="w-28" value={bank.bank_code} onChange={(e) => setBank((b) => ({ ...b, bank_code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Account name *</Label>
              <Input className="w-44" value={bank.account_name} onChange={(e) => setBank((b) => ({ ...b, account_name: e.target.value }))} />
            </div>
            <Button size="sm" disabled={!merchantId || !periodValid || !bank.account_number || !bank.bank_code || !bank.account_name || busy !== null}
              onClick={() => void runAction("create", () => merchantSettlementsApi.createSettlement(merchantId, {
                settlement_period_start: period.start,
                settlement_period_end: period.end,
                bank_account_number: bank.account_number,
                bank_code: bank.bank_code,
                account_name: bank.account_name,
              }), "Settlement created (pending)")}>
              <Plus className="h-4 w-4 mr-1" /> Create settlement
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Settlements ({settlements.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settlements for this merchant.</p>
          ) : (
            settlements.map((s) => {
              const adj = adjustForm[s.settlement_id] ?? { type: "fee_adjustment", amount: "", reason: "" };
              return (
                <div key={s.settlement_id} className="rounded-md border px-3 py-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-xs">{s.settlement_id}</span>
                    <Badge variant="outline">{s.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {String(s.settlement_period_start ?? "").slice(0, 10)} → {String(s.settlement_period_end ?? "").slice(0, 10)}
                    </span>
                    <span className="text-xs">
                      gross {String(s.gross_amount ?? "—")} · fees {String(s.fees_amount ?? "—")} · <strong>net {String(s.net_amount ?? "—")}</strong>
                    </span>
                    <span className="flex-1" />
                    {s.status === "pending" && (
                      <Button size="sm" disabled={busy !== null}
                        onClick={() => void runAction(`process-${s.settlement_id}`, () => merchantSettlementsApi.processSettlement(merchantId, s.settlement_id), "Settlement payout posted to ledger")}>
                        <Play className="h-4 w-4 mr-1" /> {busy === `process-${s.settlement_id}` ? "Processing…" : "Process payout"}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2 text-xs">
                    <div className="space-y-1">
                      <Label className="text-xs">Adjustment</Label>
                      <select className="rounded-md border bg-background px-2 py-1.5 text-xs"
                        value={adj.type}
                        onChange={(e) => setAdjustForm((f) => ({ ...f, [s.settlement_id]: { ...adj, type: e.target.value } }))}>
                        <option value="refund">refund</option>
                        <option value="chargeback">chargeback</option>
                        <option value="fee_adjustment">fee_adjustment</option>
                      </select>
                    </div>
                    <Input className="w-28 h-8 text-xs" type="number" placeholder="Amount" value={adj.amount}
                      onChange={(e) => setAdjustForm((f) => ({ ...f, [s.settlement_id]: { ...adj, amount: e.target.value } }))} />
                    <Input className="w-44 h-8 text-xs" placeholder="Reason" value={adj.reason}
                      onChange={(e) => setAdjustForm((f) => ({ ...f, [s.settlement_id]: { ...adj, reason: e.target.value } }))} />
                    <Button size="sm" variant="outline" disabled={busy !== null || !adj.amount || !adj.reason}
                      onClick={() => void runAction(`adj-${s.settlement_id}`, () => merchantSettlementsApi.adjustSettlement(merchantId, s.settlement_id, {
                        settlement_id: s.settlement_id,
                        adjustment_type: adj.type,
                        amount: Number(adj.amount),
                        reason: adj.reason,
                      }), "Adjustment recorded")}>
                      Apply adjustment
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Settlement Configuration</CardTitle>
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {config ? (
            <p className="text-xs text-muted-foreground">
              Current: frequency {String(config.settlement_frequency ?? "—")} · auto {String(config.auto_settlement ?? "—")} · minimum {String(config.minimum_settlement_amount ?? "—")} · bank {String(config.bank_account_number ?? "—")}/{String(config.bank_code ?? "—")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No settlement configuration on record for this merchant.</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Frequency</Label>
              <select className="rounded-md border bg-background px-2 py-2 text-sm" value={configForm.settlement_frequency}
                onChange={(e) => setConfigForm((f) => ({ ...f, settlement_frequency: e.target.value }))}>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Minimum amount</Label>
              <Input className="w-32" type="number" min="0" value={configForm.minimum_settlement_amount}
                onChange={(e) => setConfigForm((f) => ({ ...f, minimum_settlement_amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Auto-settle</Label>
              <select className="rounded-md border bg-background px-2 py-2 text-sm" value={configForm.auto_settlement}
                onChange={(e) => setConfigForm((f) => ({ ...f, auto_settlement: e.target.value }))}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <Button size="sm" disabled={!merchantId || busy !== null}
              onClick={() => void runAction("config", () => merchantSettlementsApi.setConfig(merchantId, {
                settlement_frequency: configForm.settlement_frequency,
                minimum_settlement_amount: configForm.minimum_settlement_amount ? Number(configForm.minimum_settlement_amount) : undefined,
                auto_settlement: configForm.auto_settlement === "true",
                bank_account_number: bank.account_number || undefined,
                bank_code: bank.bank_code || undefined,
                account_name: bank.account_name || undefined,
              }), "Configuration saved")}>
              Save configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
