import { useState } from "react";
import CrudWorkspace from "@/components/CrudWorkspace";
import { AlertTriangle, Loader2, SearchCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fraudTransactionChecksApi, type FraudTransactionCheck } from "@/api/amlFraudApi";

/**
 * W12 A4-P1-A — wires fraud-service GET /api/v1/fraud/checks/transaction/{id}
 * (previously orphaned; services/fraud-service/main.py:773) via the /fraud/v1
 * APISIX prefix.
 */
function TransactionChecksLookup() {
  const [transactionId, setTransactionId] = useState("");
  const [checks, setChecks] = useState<FraudTransactionCheck[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    if (!transactionId.trim()) return;
    setLoading(true);
    setError(null);
    setChecks(null);
    try {
      const res = await fraudTransactionChecksApi.getTransactionChecks(transactionId.trim());
      setChecks(res.checks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 pt-6 max-w-6xl mx-auto w-full">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <SearchCode className="h-4 w-4 text-orange-600" />
          <CardTitle className="text-base">Transaction Fraud Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void lookup();
            }}
          >
            <Input
              className="w-72"
              placeholder="Transaction ID (e.g. TXN-…)"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={loading || !transactionId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Look up checks
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {checks && (
            checks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fraud checks recorded for this transaction.</p>
            ) : (
              <div className="space-y-2">
                {checks.map((c, i) => (
                  <div key={String(c.check_id ?? i)} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="font-mono text-xs">{String(c.check_id ?? "—")}</span>
                    {c.risk_score !== undefined && <Badge variant="outline">risk {String(c.risk_score)}</Badge>}
                    {c.decision !== undefined && <Badge variant="outline">{String(c.decision)}</Badge>}
                    {c.status !== undefined && <Badge variant="outline">{String(c.status)}</Badge>}
                    <span className="text-xs text-muted-foreground">{String(c.created_at ?? "")}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FraudAlertsWorkspace() {
  return (
    <>
      <TransactionChecksLookup />
      <CrudWorkspace
      config={{
        domainKey: "fraud-alerts",
        title: "Fraud Alerts",
        subtitle: "Real-time alerts — flagged, blocked, under review transactions with risk scores",
        icon: AlertTriangle,
        accentColor: "text-orange-600",
        idField: "id",
        statusField: "action",
        searchFields: ["id", "customerId", "ruleName", "details"],
        apiBase: "/fraud/api/v1/fraud/alerts/{tenantId}",
        pageSize: 25,
        columns: [
          { key: "id", label: "Alert ID" },
          { key: "transactionId", label: "Transaction" },
          { key: "customerId", label: "Customer" },
          { key: "ruleName", label: "Triggered Rule", sortable: true },
          { key: "riskScore", label: "Risk Score", sortable: true },
          { key: "severity", label: "Severity", sortable: true },
          { key: "action", label: "Action" },
          { key: "createdAt", label: "Created", sortable: true },
        ],
        fields: [],
      }}
    />
    </>
  );
}
