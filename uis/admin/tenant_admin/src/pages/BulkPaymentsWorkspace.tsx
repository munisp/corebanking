import { useState, useRef } from "react";
import { Layers, Plus, Trash2, Upload, Play, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { transferApi } from "@/api/paymentsApi";

interface Recipient {
  id: string;
  accountId: string;
  displayName: string;
  amount: string;
}

interface TransferResult {
  recipient: Recipient;
  status: "success" | "failed";
  message: string;
  transactionId?: string;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyRecipient(): Recipient {
  return { id: makeId(), accountId: "", displayName: "", amount: "" };
}

export default function BulkPaymentsWorkspace() {
  const [fromAccount, setFromAccount] = useState("");
  const [fromName, setFromName] = useState("");
  const [pin, setPin] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [destination, setDestination] = useState("bpmgd");
  const [switchName, setSwitchName] = useState("mojaloop");
  const [note, setNote] = useState("Bulk Transfer");
  const [recipients, setRecipients] = useState<Recipient[]>([emptyRecipient()]);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<TransferResult[]>([]);
  const csvRef = useRef<HTMLInputElement>(null);

  function addRow() {
    setRecipients((r) => [...r, emptyRecipient()]);
  }

  function removeRow(id: string) {
    setRecipients((r) => r.filter((x) => x.id !== id));
  }

  function updateRow(id: string, field: keyof Recipient, value: string) {
    setRecipients((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }

  function handleCsvPaste(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text
        .trim()
        .split("\n")
        .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      const parsed: Recipient[] = rows
        .filter((r) => r.length >= 2 && r[0])
        .map((r) => ({
          id: makeId(),
          accountId: r[0] ?? "",
          displayName: r[1] ?? "",
          amount: r[2] ?? "",
        }));
      if (parsed.length > 0) setRecipients(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function runBulkTransfer() {
    const valid = recipients.filter((r) => r.accountId && r.amount);
    if (!valid.length || !fromAccount || !pin) return;

    setRunning(true);
    setResults([]);
    setProgress(0);

    const collected: TransferResult[] = [];

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        const res = await transferApi.initiate({
          amount: parseFloat(r.amount).toFixed(2),
          currency,
          destination,
          switch_name: switchName,
          note,
          pin,
          from: { idType: "ACCOUNT_ID", idValue: fromAccount, displayName: fromName || "Sender" },
          to: { idType: "ACCOUNT_ID", idValue: r.accountId, displayName: r.displayName || "Recipient" },
        });
        collected.push({
          recipient: r,
          status: "success",
          message: res.transferState ?? "Completed",
          transactionId: res.transactionId,
        });
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ?? (err as { message?: string })?.message ?? "Failed";
        collected.push({ recipient: r, status: "failed", message: msg });
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
      setResults([...collected]);
    }

    setRunning(false);
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const failCount = results.filter((r) => r.status === "failed").length;
  const validCount = recipients.filter((r) => r.accountId && r.amount).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-orange-600" />
        <div>
          <h1 className="text-xl font-semibold">Bulk Payments</h1>
          <p className="text-sm text-muted-foreground">
            Initiate transfers to multiple accounts via the payment hub
          </p>
        </div>
      </div>

      <Separator />

      {/* Common Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfer Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>From Account ID *</Label>
            <Input
              placeholder="e.g. 0805529423"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <Label>From Display Name</Label>
            <Input
              placeholder="Sender name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <Label>PIN *</Label>
            <Input
              type="password"
              placeholder="Transaction PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Destination</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Switch Name</Label>
            <Input
              value={switchName}
              onChange={(e) => setSwitchName(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Note / Narration</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={running}
            />
          </div>
        </CardContent>
      </Card>

      {/* Recipients Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recipients</CardTitle>
          <div className="flex gap-2">
            <input
              ref={csvRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleCsvPaste}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => csvRef.current?.click()}
              disabled={running}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import CSV
            </Button>
            <Button size="sm" variant="outline" onClick={addRow} disabled={running}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Row
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground mb-3">
            CSV format: <code>account_id, display_name, amount</code> — one recipient per line
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_120px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Account ID</span>
              <span>Display Name</span>
              <span>Amount ({currency})</span>
              <span />
            </div>
            {recipients.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_1fr_120px_36px] gap-2">
                <Input
                  placeholder="Account ID"
                  value={r.accountId}
                  onChange={(e) => updateRow(r.id, "accountId", e.target.value)}
                  disabled={running}
                />
                <Input
                  placeholder="Display name"
                  value={r.displayName}
                  onChange={(e) => updateRow(r.id, "displayName", e.target.value)}
                  disabled={running}
                />
                <Input
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  value={r.amount}
                  onChange={(e) => updateRow(r.id, "amount", e.target.value)}
                  disabled={running}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => removeRow(r.id)}
                  disabled={running || recipients.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action */}
      <div className="flex items-center gap-4">
        <Button
          onClick={runBulkTransfer}
          disabled={running || !fromAccount || !pin || validCount === 0}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {running ? `Processing ${progress}%…` : `Process ${validCount} Transfer${validCount !== 1 ? "s" : ""}`}
        </Button>
        {running && (
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Results</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-green-700 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {successCount} Success
              </Badge>
              <Badge variant="outline" className="text-destructive border-destructive/30">
                <XCircle className="h-3 w-3 mr-1" />
                {failCount} Failed
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_1fr_100px_1fr] gap-2 text-xs font-medium text-muted-foreground px-1 mb-2">
                <span>Account ID</span>
                <span>Display Name</span>
                <span>Amount</span>
                <span>Status / Message</span>
              </div>
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[1fr_1fr_100px_1fr] gap-2 text-sm px-1 py-1.5 rounded ${
                    result.status === "success" ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <span className="font-mono text-xs">{result.recipient.accountId}</span>
                  <span>{result.recipient.displayName || "—"}</span>
                  <span>{currency} {parseFloat(result.recipient.amount).toFixed(2)}</span>
                  <div className="flex items-center gap-1.5">
                    {result.status === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <span className={`text-xs ${result.status === "failed" ? "text-destructive" : "text-green-700"}`}>
                      {result.transactionId ? `${result.message} · ${result.transactionId}` : result.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
