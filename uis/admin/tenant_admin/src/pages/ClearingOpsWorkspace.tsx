/**
 * Clearing Operations Workspace — W12 A4-P1-A
 *
 * Wires the previously-orphaned banking-clearing-ops-rs routes
 * (gateway prefix /banking-clearing-ops):
 *   GET /v1/cheque/clearing-gl | /v1/collateral/gl | /v1/cash/management-gl
 *       /v1/swift/correspondent-gl | /v1/alerts
 *   GET/POST /api/v1/settlements   GET/PUT/DELETE /api/v1/settlements/{id}
 */
import { useCallback, useEffect, useState } from "react";
import { BellRing, Landmark, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { clearingOpsRsApi, type ClearingSettlementRecord } from "@/api/settlementClearingApi";

const GL_VIEWS = [
  { key: "cheque", label: "Cheque Clearing GL", fetch: clearingOpsRsApi.chequeClearingGl },
  { key: "collateral", label: "Collateral GL", fetch: clearingOpsRsApi.collateralGl },
  { key: "cash", label: "Cash Management GL", fetch: clearingOpsRsApi.cashManagementGl },
  { key: "swift", label: "SWIFT Correspondent GL", fetch: clearingOpsRsApi.swiftCorrespondentGl },
] as const;

export default function ClearingOpsWorkspace() {
  const [glData, setGlData] = useState<Record<string, unknown>>({});
  const [glErrors, setGlErrors] = useState<Record<string, string>>({});
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [alertMeta, setAlertMeta] = useState<{ rules?: number; error_rate?: number } | null>(null);
  const [settlements, setSettlements] = useState<ClearingSettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ batchId: "", settlementType: "rtgs", counterparty: "", netAmountKobo: "", currency: "NGN", reference: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const glResults = await Promise.all(
      GL_VIEWS.map(async (v) => {
        try {
          return { key: v.key as string, data: await v.fetch(), error: null as string | null };
        } catch (e) {
          return { key: v.key as string, data: null, error: e instanceof Error ? e.message : "unavailable" };
        }
      }),
    );
    const nextData: Record<string, unknown> = {};
    const nextErr: Record<string, string> = {};
    for (const r of glResults) {
      if (r.error) nextErr[r.key] = r.error;
      else nextData[r.key] = r.data;
    }
    setGlData(nextData);
    setGlErrors(nextErr);

    try {
      const a = await clearingOpsRsApi.alerts();
      if (Array.isArray(a)) setAlerts(a as Record<string, unknown>[]);
      else {
        const obj = a as { alerts?: Record<string, unknown>[]; rules?: number; error_rate?: number };
        setAlerts(obj.alerts ?? []);
        setAlertMeta({ rules: obj.rules, error_rate: obj.error_rate });
      }
    } catch {
      setAlerts([]);
    }

    try {
      const s = await clearingOpsRsApi.listSettlements({ limit: 100 });
      setSettlements(s.items ?? []);
    } catch {
      setSettlements([]);
    }
    setLoading(false);
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-indigo-700" />
          <div>
            <h1 className="text-xl font-semibold">Clearing Operations</h1>
            <p className="text-sm text-muted-foreground">
              GL clearing positions, ops alerts and settlement records (banking-clearing-ops-rs)
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        {GL_VIEWS.map((v) => (
          <Card key={v.key}>
            <CardHeader><CardTitle className="text-base">{v.label}</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : glErrors[v.key] ? (
                <p className="text-sm text-destructive">Unavailable: {glErrors[v.key]}</p>
              ) : (
                <pre className="max-h-56 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(glData[v.key], null, 2)}</pre>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Operations Alerts</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BellRing className="h-4 w-4" />
            {alertMeta ? `${alertMeta.rules ?? 0} rules · error rate ${((alertMeta.error_rate ?? 0) * 100).toFixed(2)}%` : ""}
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts firing.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Badge variant="outline">{String(a.severity ?? "info")}</Badge>
                  <span>{String(a.rule ?? a.message ?? JSON.stringify(a))}</span>
                  {"value" in a && <span className="text-xs text-muted-foreground">value: {String(a.value)}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Settlement Records ({settlements.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Batch ID *</Label>
              <Input className="w-36" value={form.batchId} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Input className="w-24" value={form.settlementType} onChange={(e) => setForm((f) => ({ ...f, settlementType: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Counterparty *</Label>
              <Input className="w-36" value={form.counterparty} onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Net (kobo) *</Label>
              <Input className="w-32" type="number" value={form.netAmountKobo} onChange={(e) => setForm((f) => ({ ...f, netAmountKobo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reference</Label>
              <Input className="w-32" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
            <Button size="sm" disabled={busy !== null || !form.batchId || !form.counterparty || !form.netAmountKobo}
              onClick={() => void runAction("create", () => clearingOpsRsApi.createSettlement({
                batchId: form.batchId,
                settlementType: form.settlementType,
                counterparty: form.counterparty,
                netAmountKobo: Number(form.netAmountKobo),
                currency: form.currency,
                reference: form.reference || undefined,
                status: "pending",
              }), "Settlement record created")}>
              <Plus className="h-4 w-4 mr-1" /> New record
            </Button>
          </div>

          {settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settlement records.</p>
          ) : (
            settlements.map((s) => (
              <div key={String(s.id)} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-mono text-xs">{String(s.id).slice(0, 8)}…</span>
                <Badge variant="outline">{String(s.status ?? "unknown")}</Badge>
                <span className="text-xs text-muted-foreground">
                  {String(s.batchId ?? "")} · {String(s.settlementType ?? "")} · {String(s.counterparty ?? "")} · {String(s.netAmountKobo ?? "")} {String(s.currency ?? "")}
                </span>
                <span className="flex-1" />
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => void runAction(`complete-${s.id}`, () => clearingOpsRsApi.updateSettlement(String(s.id), { ...s, status: "completed" }), "Settlement marked completed")}>
                  Mark completed
                </Button>
                <Button size="sm" variant="ghost" disabled={busy !== null}
                  onClick={() => void runAction(`del-${s.id}`, () => clearingOpsRsApi.deleteSettlement(String(s.id)), "Settlement record deleted")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
