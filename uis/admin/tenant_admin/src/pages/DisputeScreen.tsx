import { AlertTriangle } from "lucide-react";
import { BACKEND_URL } from "../const";
import React, { useState } from "react";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useTenantBranding } from "../contexts/TenantBrandingContext";

const DisputeScreen: React.FC = () => {
  const { primaryColor } = useTenantBranding();
  const [transactionId, setTransactionId] = useState("");
  const [disputeType, setDisputeType] = useState("INSURANCE");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/dispute/api/v1/disputes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_id: transactionId,
            dispute_type: disputeType,
            description,
          }),
        },
      );
      const data = await response.json();
      setResult(JSON.stringify(data));
    } catch (err) {
      setResult("Error submitting dispute");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dispute Filing"
          title="Submit Dispute"
          description="File a dispute for a transaction"
          icon={<AlertTriangle className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 flex justify-center">
        <Card className="w-full max-w-2xl">
          <form onSubmit={handleSubmit} autoComplete="off">
            <CardHeader>
              <CardTitle>Submit Dispute</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="transactionId">Transaction ID</Label>
                <Input
                  id="transactionId"
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="disputeType">Dispute Type</Label>
                <select
                  id="disputeType"
                  className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs"
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                >
                  <option value="INSURANCE">Insurance</option>
                  <option value="FRAUD">Fraud</option>
                  <option value="UNAUTHORIZED">Unauthorized</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>
              {result && (
                <div className="bg-muted rounded p-2 text-xs mt-2">
                  <strong>Result:</strong>
                  <pre className="whitespace-pre-wrap break-all">{result}</pre>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full text-white"
                disabled={loading}
                style={{ backgroundColor: loading ? undefined : primaryColor }}
              >
                {loading ? "Submitting..." : "Submit Dispute"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default DisputeScreen;
