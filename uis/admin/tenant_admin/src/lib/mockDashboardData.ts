// Mock data for dashboard transactions and alerts

export const mockDashboardMetrics = {
  tenant_id: 'mock-tenant',
  total_customers: 12000,
  total_accounts: 3500,
  total_transactions: 980000,
  total_volume: 1250000000, // ₦1.25B
  active_users: 8000,
};

export const mockUsageStats = {
  totalEvents: 980000,
  byTenant: [
    { tenantId: 'Bank A', totalEvents: 250000 },
    { tenantId: 'Bank B', totalEvents: 200000 },
    { tenantId: 'Bank C', totalEvents: 180000 },
    { tenantId: 'Bank D', totalEvents: 170000 },
    { tenantId: 'Bank E', totalEvents: 180000 },
  ],
  byEventType: [
    { eventType: 'login', count: 400000 },
    { eventType: 'transfer', count: 300000 },
    { eventType: 'withdrawal', count: 150000 },
    { eventType: 'deposit', count: 130000 },
  ],
};

export const mockBillingStats = {
  totalRevenue: '1250000000',
};

export const mockTenantStats = {
  byStatus: [
    { status: 'active', _count: 8000 },
    { status: 'inactive', _count: 4000 },
  ],
  byTier: [
    { subscriptionTier: 'basic', _count: 2000 },
    { subscriptionTier: 'professional', _count: 5000 },
    { subscriptionTier: 'enterprise', _count: 5000 },
  ],
  total: 12000,
};

export const mockUsageTrends = [
  { date: new Date().toISOString(), count: 200000 },
  { date: new Date(Date.now() - 86400000).toISOString(), count: 180000 },
  { date: new Date(Date.now() - 2*86400000).toISOString(), count: 160000 },
  { date: new Date(Date.now() - 3*86400000).toISOString(), count: 140000 },
  { date: new Date(Date.now() - 4*86400000).toISOString(), count: 120000 },
  { date: new Date(Date.now() - 5*86400000).toISOString(), count: 100000 },
  { date: new Date(Date.now() - 6*86400000).toISOString(), count: 80000 },
];

export const mockRecentAlerts = {
  total: 3,
  alerts: [
    {
      id: 'alert-1',
      title: 'Large Transaction Spike',
      message: 'A sudden spike in transactions detected.',
      severity: 'high',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'alert-2',
      title: 'Unusual Withdrawal Pattern',
      message: 'Withdrawals exceeded normal limits.',
      severity: 'critical',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'alert-3',
      title: 'Login Failure Rate Increased',
      message: 'Multiple failed login attempts detected.',
      severity: 'medium',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
};

export const mockAlerts = [
  {
    id: 'alert-1',
    type: 'spike',
    severity: 'high',
    title: 'Large Transaction Spike',
    message: 'A sudden spike in transactions detected.',
    timestamp: new Date().toISOString(),
    metric: 'transactions',
    value: 50000,
    threshold: 30000,
    status: 'open',
  },
  {
    id: 'alert-2',
    type: 'threshold',
    severity: 'critical',
    title: 'Unusual Withdrawal Pattern',
    message: 'Withdrawals exceeded normal limits.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    metric: 'withdrawals',
    value: 20000,
    threshold: 10000,
    status: 'open',
  },
  {
    id: 'alert-3',
    type: 'error_rate',
    severity: 'medium',
    title: 'Login Failure Rate Increased',
    message: 'Multiple failed login attempts detected.',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    metric: 'logins',
    value: 3000,
    threshold: 1000,
    status: 'open',
  },
];
