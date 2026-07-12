import { Flag, Search } from "lucide-react";
import { useEffect, useState } from "react";
import apiClient from "@/services/api";
import { getTenantId } from "@/lib/utils";

interface Feature {
  id: number;
  name: string;
  category: string;
  enabled: number;
  total: number;
  adoption: number;
  tier: string;
}

interface FeatureSummary {
  total_features?: number;
  totalFeatures?: number;
  enabled_count?: number;
  enabledCount?: number;
  premium_count?: number;
  premiumCount?: number;
  avg_adoption?: number;
  avgAdoption?: number;
}

export default function FeatureFlags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [featureSummary, setFeatureSummary] = useState<FeatureSummary>({});

  useEffect(() => {
    const tenantId = localStorage.getItem('tenant_id') || '';
    Promise.all([
      apiClient.get('/feature-flag-engine/features', { params: { tenant_id: tenantId } }),
      apiClient.get('/feature-flag-engine/summary', { params: { tenant_id: tenantId } }),
    ])
      .then(([featuresRes, summaryRes]) => {
        const featureData = Array.isArray(featuresRes.data) ? featuresRes.data : featuresRes.data?.features ?? featuresRes.data?.data ?? [];
        setFeatures(featureData as Feature[]);
        if (summaryRes.data) setFeatureSummary(summaryRes.data as FeatureSummary);
      })
      .catch(() => { /* service unavailable — show empty state */ });
  }, []);

  const filteredFeatures = features.filter(feature => {
    const matchesSearch = feature.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || feature.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getTierColor = (tier: string) => {
    return tier === 'Premium' 
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background ">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Flag className="w-8 h-8 text-blue-600" />
              Feature Flags Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Control platform features across all banks
            </p>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-3xl font-bold text-foreground">{(featureSummary.total_features ?? featureSummary.totalFeatures ?? features.length) || '—'}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Features</div>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{featureSummary.enabled_count ?? featureSummary.enabledCount ?? '—'}</div>
            <div className="text-sm text-muted-foreground mt-1">Enabled</div>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{featureSummary.premium_count ?? featureSummary.premiumCount ?? '—'}</div>
            <div className="text-sm text-muted-foreground mt-1">Premium</div>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{featureSummary.avg_adoption != null ? `${featureSummary.avg_adoption}%` : featureSummary.avgAdoption != null ? `${featureSummary.avgAdoption}%` : '—'}</div>
            <div className="text-sm text-muted-foreground mt-1">Avg Adoption</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="Payment Services">Payment Services</option>
              <option value="Banking Products">Banking Products</option>
              <option value="Wealth Management">Wealth Management</option>
            </select>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredFeatures.map((feature) => (
            <div key={feature.id} className="bg-card rounded-xl shadow-lg p-6 border border-border">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{feature.category}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTierColor(feature.tier)}`}>
                  {feature.tier}
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Adoption Rate</span>
                  <span className="font-semibold text-foreground">{feature.adoption}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${feature.adoption}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Banks Using: </span>
                  <span className="font-semibold text-foreground">{feature.enabled}/{feature.total}</span>
                </div>
                {/* <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all">
                  View Details
                </button> */}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
