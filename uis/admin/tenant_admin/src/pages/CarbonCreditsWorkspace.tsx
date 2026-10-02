import { useCallback, useEffect, useState } from "react";
import CrudWorkspace from "@/components/CrudWorkspace";
import { Leaf, Loader2, Handshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { carbonTradingApi, type CarbonTrade } from "@/api/carbonApi";

/**
 * W12 A4-P1-A — carbon trade settlement desk.
 * Wires previously-orphaned carbon-service routes:
 *   GET /api/v1/carbon/trades, POST /api/v1/carbon/trades/:id/settle (PIN),
 *   GET /api/v1/carbon/footprints (tab below), GET /api/v1/carbon/footprints/:id.
 */
function TradeSettlementDesk() {
  const [trades, setTrades] = useState<CarbonTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settleTarget, setSettleTarget] = useState<CarbonTrade | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await carbonTradingApi.listTrades();
      setTrades(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load carbon trades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function settle() {
    if (!settleTarget || !pin) return;
    setBusy(true);
    try {
      await carbonTradingApi.settleTrade(settleTarget.trade_id, pin);
      toast.success(`Trade ${settleTarget.trade_id} settled`);
      setSettleTarget(null);
      setPin("");
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? (e instanceof Error ? e.message : "Settlement failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 pb-6 max-w-6xl mx-auto w-full">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Handshake className="h-4 w-4 text-teal-700" />
          <CardTitle className="text-base">Carbon Trade Settlement Desk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading trades…</div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : trades.length === 0 ? (
            <p className="text-sm text-muted-foreground">No carbon trades recorded.</p>
          ) : (
            trades.map((t) => (
              <div key={t.trade_id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-mono text-xs">{t.trade_id}</span>
                <Badge variant="outline">{t.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  credit {t.credit_id} · {t.quantity}t @ {t.price_per_unit} {t.currency} · total {t.total_amount} {t.currency}
                </span>
                <span className="flex-1" />
                {t.status !== "settled" && t.status !== "completed" && (
                  <Button size="sm" onClick={() => setSettleTarget(t)}>Settle</Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={settleTarget !== null} onOpenChange={() => { setSettleTarget(null); setPin(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Settle trade {settleTarget?.trade_id}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Settlement transfers {settleTarget?.quantity}t of credit {settleTarget?.credit_id} for {settleTarget?.total_amount} {settleTarget?.currency}. Enter the operator transaction PIN to confirm.
            </p>
            <div className="space-y-1">
              <Label>Transaction PIN</Label>
              <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSettleTarget(null); setPin(""); }}>Cancel</Button>
            <Button disabled={!pin || busy} onClick={() => void settle()}>{busy ? "Settling…" : "Confirm settlement"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CarbonCreditsWorkspace() {
  return (
    <>
      <TradeSettlementDesk />
      <CrudWorkspace
      config={{
        domainKey: "carbon-credits",
        title: "Carbon Credits",
        subtitle: "Carbon credit projects, trades, and customer footprint offsets",
        icon: Leaf,
        accentColor: "text-teal-700",
        idField: "credit_id",
        statusField: "status",
        searchFields: ["credit_id", "project_id", "customer_id", "project_name"],
        // W12 A4-P1-A: fixed path — carbon.yaml rewrites /carbon/(.*)→/$1 and
        // carbon-service serves /api/v1/carbon/*, so the full prefix is required.
        apiBase: "/carbon/api/v1/carbon/credits",
        pageSize: 25,
        columns: [
          { key: "credit_id",    label: "Credit ID" },
          { key: "project_name", label: "Project",       sortable: true },
          { key: "customer_id",  label: "Customer",      sortable: true },
          { key: "quantity",     label: "Tonnes CO₂",    sortable: true,
            render: (v) => `${Number(v).toLocaleString()} t` },
          { key: "price_per_tonne", label: "Price/Tonne", sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "total_value",  label: "Total Value",   sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "vintage_year", label: "Vintage",       sortable: true },
          { key: "standard",     label: "Standard",      sortable: true },
          { key: "status",       label: "Status",        sortable: true },
          { key: "created_at",   label: "Date",          sortable: true },
        ],
        fields: [
          { key: "project_id",      label: "Project ID",    type: "text", required: true },
          { key: "quantity",        label: "Quantity (tonnes)", type: "number", required: true },
          { key: "price_per_tonne", label: "Price per Tonne (₦)", type: "number", required: true },
          { key: "vintage_year",    label: "Vintage Year",  type: "number" },
          { key: "standard",        label: "Standard",      type: "text" },
        ],
        // W12 A4-P1-A: wire footprints list (previously orphaned family).
        tabs: [
          {
            key: "footprints", label: "Footprints", apiBase: "/carbon/api/v1/carbon/footprints",
            columns: [
              { key: "footprint_id", label: "Footprint ID" },
              { key: "entity_id", label: "Entity", sortable: true },
              { key: "entity_type", label: "Type" },
              { key: "scope1", label: "Scope 1", sortable: true },
              { key: "scope2", label: "Scope 2", sortable: true },
              { key: "scope3", label: "Scope 3", sortable: true },
              { key: "total", label: "Total", sortable: true },
              { key: "period_start", label: "Period" },
            ],
          },
        ],
      }}
    />
    </>
  );
}
