import { Activity, Download, FileText, Shield } from "lucide-react";
import { useState } from "react";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import apiClient from "../services/api";

// Insurance API IDs (update as needed)
// Policy ID: POL1765494577
// Claim ID: CLM1765495156
const POLICY_ID = "POL1765494577";
const CLAIM_ID = "CLM1765495156";

const defaultPolicyPayload = {
  policy_type: "health",
  coverage_amount: 10000,
  duration_months: 24,
  beneficiaries: [],
  additional_info: {},
};

export default function InsuranceManagement() {
  const { primaryColor } = useTenantBranding();
  const [premiumPayments, setPremiumPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Use apiClient for all insurance API calls
  const handleListPremiums = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiClient.get(
        `/insurance/api/v1/insurance/premiums/policy/${POLICY_ID}`,
      );
      setPremiumPayments(res.data);
    } catch (e: any) {
      setMessage(e.message || "Failed to fetch premiums");
    }
    setLoading(false);
  };

  const handlePayClaim = async () => {
    setLoading(true);
    setMessage("");
    try {
      await apiClient.post(
        `/insurance/api/v1/administration/insurance/claims/${CLAIM_ID}/pay`,
      );
      setMessage("Claim paid successfully");
    } catch (e: any) {
      setMessage(e.message || "Failed to pay claim");
    }
    setLoading(false);
  };

  const handleReviewClaim = async () => {
    setLoading(true);
    setMessage("");
    try {
      await apiClient.post(
        `/insurance/api/v1/administration/insurance/claims/${CLAIM_ID}/review`,
        {},
      );
      setMessage("Claim reviewed successfully");
    } catch (e: any) {
      setMessage(e.message || "Failed to review claim");
    }
    setLoading(false);
  };

  const handleActivatePolicy = async () => {
    setLoading(true);
    setMessage("");
    try {
      await apiClient.post(
        `/insurance/api/v1/administration/insurance/policies/${POLICY_ID}/activate`,
        defaultPolicyPayload,
      );
      setMessage("Policy activated successfully");
    } catch (e: any) {
      setMessage(e.message || "Failed to activate policy");
    }
    setLoading(false);
  };

  const handleDeactivatePolicy = async () => {
    setLoading(true);
    setMessage("");
    try {
      await apiClient.post(
        `/insurance/api/v1/insurance/policies/${POLICY_ID}/deactivate`,
        defaultPolicyPayload,
      );
      setMessage("Policy deactivated successfully");
    } catch (e: any) {
      setMessage(e.message || "Failed to deactivate policy");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background ">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" style={{ color: primaryColor }} />
            <h1 className="text-3xl font-bold text-foreground">
              Insurance Management
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Manage insurance policies, claims, and premium payments
          </p>
        </div>
      </div>

      <div className="container py-8">
        {/* Actions */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-8 flex flex-wrap gap-3">
          <button
            onClick={handleListPremiums}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            List Premium Payments
          </button>
          <button
            onClick={handlePayClaim}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-semibold text-white bg-green-600"
          >
            Pay Claim
          </button>
          <button
            onClick={handleReviewClaim}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-semibold text-white bg-yellow-600"
          >
            Review Claim
          </button>
          <button
            onClick={handleActivatePolicy}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600"
          >
            Activate Policy
          </button>
          <button
            onClick={handleDeactivatePolicy}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-semibold text-white bg-red-600"
          >
            Deactivate Policy
          </button>
        </div>

        {/* Message */}
        {message && <div className="mb-4 text-sm text-red-600">{message}</div>}

        {/* Premium Payments Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Premium Payments
            </h3>
            <button
              onClick={handleListPremiums}
              disabled={loading}
              className="px-3 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">
                Loading premium payments...
              </p>
            </div>
          ) : !Array.isArray(premiumPayments) ||
            premiumPayments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No premium payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {Object.keys(premiumPayments[0] || {}).map((key) => (
                      <th
                        key={key}
                        className="px-6 py-4 text-left text-sm font-semibold text-foreground"
                      >
                        {key
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {premiumPayments.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      {Object.values(p).map((val, j) => (
                        <td
                          key={j}
                          className="px-6 py-4 text-sm text-foreground"
                        >
                          {typeof val === "object"
                            ? JSON.stringify(val)
                            : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
