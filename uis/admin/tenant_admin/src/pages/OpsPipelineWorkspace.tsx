/**
 * Ops Pipeline (EOD) Workspace — W12 A4-P1-A
 *
 * Wires the previously-orphaned banking-operations-pipeline-py routes
 * (gateway prefix /banking-operations-pipeline):
 *   GET /v1/eod/reconciliation | /v1/fees/revenue | /v1/treasury/mtm
 *       /v1/settlement/positions | /v1/dormancy/escheatment | /v1/middleware
 *   GET /v1/list  POST /v1/create  POST /v1/eod/run-all
 */
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, Play, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { opsPipelineApi } from "@/api/settlementClearingApi";

const VIEWS = [
  { key: "recon", label: "EOD Reconciliation", fetch: opsPipelineApi.eodReconciliation },
  { key: "fees", label: "Fee Revenue", fetch: opsPipelineApi.feesRevenue },
  { key: "mtm", label: "Treasury MTM", fetch: opsPipelineApi.treasuryMtm },
  { key: "positions", label: "Settlement Positions", fetch: opsPipelineApi.settlementPositions },
  { key: "dormancy", label: "Dormancy / Escheatment", fetch: opsPipelineApi.dormancyEscheatment },
  { key: "middleware", label: "Middleware Config", fetch: opsPipelineApi.middlewareConfig },
] as const;

export default function OpsPipelineWorkspace() {
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [viewData, setViewData] = useState<Record<string, unknown>>({});
  const [viewErrors, setViewErrors] = useState<Record<string, string>>({});
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [recordsSource, setRecordsSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [eodResult, setEodResult] = useState<unknown>(null);
  const [newRecordJson, setNewRecordJson] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(
      VIEWS.map(async (v) => {
        try {
          return { key: v.key as string, data: await v.fetch(businessDate), error: null as string | null };
        } catch (e) {
          return { key: v.key as string, data: null, error: e instanceof Error ? e.message : "unavailable" };
        }
      }),
    );
    const data: Record<string, unknown> = {};
    const errs: Record<string, string> = {};
    for (const r of results) {
      if (r.error) errs[r.key] = r.error;
      else data[r.key] = r.data;
    }
    setViewData(data);
    setViewErrors(errs);
    try {
      const list = await opsPipelineApi.list();
      setRecords(list.records ?? []);
      setRecordsSource(list.source ?? "");
    } catch {
      setRecords([]);
    }
    setLoading(false);
  }, [businessDate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runEod() {
    setBusy("eod");
    setEodResult(null);
    try {
      const res = await opsPipelineApi.runAllEod(businessDate);
      setEodResult(res);
      toast.success(`EOD batch ${res.batch_id} executed`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "EOD run failed");
    } finally {
      setBusy(null);
    }
  }

  async function createRecord() {
    if (!newRecordJson.trim()) return;
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(newRecordJson) as Record<string, unknown>;
    } catch {
      toast.error("Record must be valid JSON");
      return;
    }
    setBusy("create");
    try {
      await opsPipelineApi.create(body);
      toast.success("Pipeline record created");
      setNewRecordJson("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-indigo-700" />
          <div>
            <h1 className="text-xl font-semibold">Banking Operations Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              End-of-day processing, settlement positions, fees and treasury MTM (banking-operations-pipeline-py)
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Business date</Label>
            <Input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </div>
          <Button onClick={() => void runEod()} disabled={busy !== null}>
            <Play className="h-4 w-4 mr-1" /> {busy === "eod" ? "Running EOD…" : "Run full EOD"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Separator />

      {eodResult != null && (
        <Card>
          <CardHeader><CardTitle className="text-base">EOD Run Result</CardTitle></CardHeader>
          <CardContent>
            <pre className="max-h-56 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(eodResult, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {VIEWS.map((v) => (
          <Card key={v.key}>
            <CardHeader><CardTitle className="text-base">{v.label}</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : viewErrors[v.key] ? (
                <p className="text-sm text-destructive">Unavailable: {viewErrors[v.key]}</p>
              ) : (
                <pre className="max-h-56 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(viewData[v.key], null, 2)}</pre>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline Records ({records.length}{recordsSource ? ` · ${recordsSource}` : ""})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 flex-1 min-w-64">
              <Label className="text-xs">New record (JSON)</Label>
              <Input value={newRecordJson} onChange={(e) => setNewRecordJson(e.target.value)} placeholder='{"data": {"kind": "manual-adjustment"}}' />
            </div>
            <Button size="sm" variant="outline" disabled={busy !== null || !newRecordJson.trim()} onClick={() => void createRecord()}>
              Create record
            </Button>
          </div>
          {records.length > 0 && (
            <pre className="max-h-56 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(records.slice(0, 20), null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
