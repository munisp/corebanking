/**
 * F1: Analytics & BI engine — dashboards, data aggregation, trend analysis.
 * F2: OpenSearch integration for full-text search and log analysis.
 * F3: Lakehouse ETL pipeline definitions for batch data processing.
 */

export interface DashboardWidget {
  id: string;
  title: string;
  type: "metric" | "chart" | "table" | "heatmap";
  category: "financial" | "operational" | "risk" | "customer";
  value: number | string;
  trend?: number;
  trendDirection?: "up" | "down" | "flat";
  unit?: string;
  period: string;
  data?: Record<string, unknown>[];
}

export interface ETLPipeline {
  id: string;
  name: string;
  source: string;
  destination: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  status: "active" | "paused" | "failed";
  recordsProcessed?: number;
  avgDurationMs?: number;
}

const dashboardWidgets: DashboardWidget[] = [
  // Financial KPIs
  { id: "W-001", title: "Total Deposits", type: "metric", category: "financial", value: 420_000_000_000, trend: 3.2, trendDirection: "up", unit: "NGN", period: "2026-Q2" },
  { id: "W-002", title: "Total Loans Outstanding", type: "metric", category: "financial", value: 380_000_000_000, trend: 1.8, trendDirection: "up", unit: "NGN", period: "2026-Q2" },
  { id: "W-003", title: "Net Interest Margin", type: "metric", category: "financial", value: "5.2%", trend: 0.3, trendDirection: "up", unit: "%", period: "2026-Q2" },
  { id: "W-004", title: "Cost-to-Income Ratio", type: "metric", category: "financial", value: "48.5%", trend: -1.2, trendDirection: "down", unit: "%", period: "2026-Q2" },
  { id: "W-005", title: "Return on Equity", type: "metric", category: "financial", value: "18.7%", trend: 2.1, trendDirection: "up", unit: "%", period: "2026-Q2" },

  // Risk KPIs
  { id: "W-006", title: "NPL Ratio", type: "metric", category: "risk", value: "3.8%", trend: -0.5, trendDirection: "down", unit: "%", period: "2026-Q2" },
  { id: "W-007", title: "Capital Adequacy Ratio", type: "metric", category: "risk", value: "21.03%", trend: 0.8, trendDirection: "up", unit: "%", period: "2026-Q2" },
  { id: "W-008", title: "Liquidity Coverage Ratio", type: "metric", category: "risk", value: "145%", trend: 5, trendDirection: "up", unit: "%", period: "2026-Q2" },
  { id: "W-009", title: "Provision Coverage", type: "metric", category: "risk", value: "142%", trend: 3, trendDirection: "up", unit: "%", period: "2026-Q2" },

  // Operational KPIs
  { id: "W-010", title: "Daily NIP Volume", type: "metric", category: "operational", value: 125_000, trend: 8.5, trendDirection: "up", unit: "txns", period: "2026-05-09" },
  { id: "W-011", title: "ATM Uptime", type: "metric", category: "operational", value: "97.3%", trend: 0.2, trendDirection: "up", unit: "%", period: "2026-05-09" },
  { id: "W-012", title: "Digital Channel Adoption", type: "metric", category: "operational", value: "73%", trend: 5, trendDirection: "up", unit: "%", period: "2026-Q2" },

  // Customer KPIs
  { id: "W-013", title: "Total Active Customers", type: "metric", category: "customer", value: 4_500_000, trend: 12, trendDirection: "up", unit: "customers", period: "2026-Q2" },
  { id: "W-014", title: "Net Promoter Score", type: "metric", category: "customer", value: 42, trend: 3, trendDirection: "up", unit: "NPS", period: "2026-Q2" },
  { id: "W-015", title: "Customer Acquisition Cost", type: "metric", category: "customer", value: 12_500, trend: -8, trendDirection: "down", unit: "NGN", period: "2026-Q2" },

  // Revenue by channel chart
  {
    id: "W-016", title: "Revenue by Channel", type: "chart", category: "financial", value: "chart",
    period: "2026-Q2",
    data: [
      { channel: "Internet Banking", revenue: 8_500_000_000, percentage: 28 },
      { channel: "Mobile Banking", revenue: 10_200_000_000, percentage: 34 },
      { channel: "Branch", revenue: 5_100_000_000, percentage: 17 },
      { channel: "ATM", revenue: 3_000_000_000, percentage: 10 },
      { channel: "POS", revenue: 2_400_000_000, percentage: 8 },
      { channel: "USSD", revenue: 900_000_000, percentage: 3 },
    ],
  },

  // Transaction volume trend
  {
    id: "W-017", title: "Transaction Volume Trend", type: "chart", category: "operational", value: "chart",
    period: "2026-Q2",
    data: [
      { month: "Jan", volume: 3_200_000, value: 450_000_000_000 },
      { month: "Feb", volume: 3_100_000, value: 420_000_000_000 },
      { month: "Mar", volume: 3_500_000, value: 510_000_000_000 },
      { month: "Apr", volume: 3_800_000, value: 550_000_000_000 },
      { month: "May", volume: 3_750_000, value: 530_000_000_000 },
    ],
  },
];

const etlPipelines: ETLPipeline[] = [
  { id: "ETL-001", name: "Transaction Data Lake Ingestion", source: "PostgreSQL (transactions)", destination: "S3/Lakehouse (bronze)", schedule: "*/15 * * * *", lastRun: "2026-05-09T14:45:00Z", nextRun: "2026-05-09T15:00:00Z", status: "active", recordsProcessed: 45_000, avgDurationMs: 12_000 },
  { id: "ETL-002", name: "Customer 360 Aggregation", source: "Multiple services", destination: "PostgreSQL (analytics)", schedule: "0 2 * * *", lastRun: "2026-05-09T02:00:00Z", nextRun: "2026-05-10T02:00:00Z", status: "active", recordsProcessed: 4_500_000, avgDurationMs: 180_000 },
  { id: "ETL-003", name: "Risk Score Computation", source: "Transaction + Customer data", destination: "Redis (cache) + OpenSearch", schedule: "0 */4 * * *", lastRun: "2026-05-09T12:00:00Z", nextRun: "2026-05-09T16:00:00Z", status: "active", recordsProcessed: 1_200_000, avgDurationMs: 95_000 },
  { id: "ETL-004", name: "Regulatory Reporting Extract", source: "PostgreSQL (all schemas)", destination: "S3 (regulatory/)", schedule: "0 0 1 * *", lastRun: "2026-05-01T00:00:00Z", nextRun: "2026-06-01T00:00:00Z", status: "active", recordsProcessed: 12_000_000, avgDurationMs: 600_000 },
  { id: "ETL-005", name: "OpenSearch Log Indexing", source: "Kafka (logs topic)", destination: "OpenSearch (logs-*)", schedule: "real-time", lastRun: "2026-05-09T14:59:00Z", status: "active", recordsProcessed: 500_000, avgDurationMs: 0 },
  { id: "ETL-006", name: "Fraud Pattern Analysis", source: "Transaction stream", destination: "ML model + PostgreSQL", schedule: "*/5 * * * *", lastRun: "2026-05-09T14:55:00Z", nextRun: "2026-05-09T15:00:00Z", status: "active", recordsProcessed: 25_000, avgDurationMs: 8_000 },
];

export function getDashboardWidgets() { return dashboardWidgets; }
export function getETLPipelines() { return etlPipelines; }

export function getWidgetsByCategory(category: string) {
  const filtered = dashboardWidgets.filter((w) => w.category === category);
  return { items: filtered, total: filtered.length };
}
