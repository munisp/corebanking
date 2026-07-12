import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import apiClient from '@/services/api';
import { Activity, BarChart3, DollarSign, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Helper: group transactions by month
function groupByMonth(transactions: any[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = months[d.getMonth()];
    // const year = d.getFullYear();
    const txns = transactions.filter((t: any) => {
      const dt = new Date(t.created_at || t.date || t.timestamp);
      return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
    });
    result.push({
      month,
      transactions: txns.length,
      revenue: txns.reduce((sum: any, t: any) => sum + (parseFloat(t.amount) || 0), 0),
      users: new Set(txns.map((t: any) => t.customer_id || t.user_id)).size,
    });
  }
  return result;
}

// Helper: channel distribution (mocked, as real channel data may not be available)
const channelData = [
  { name: 'Mobile App', value: 45, color: '#3b82f6' },
  { name: 'Web Portal', value: 30, color: '#8b5cf6' },
  { name: 'USSD', value: 15, color: '#06b6d4' },
];

// Helper: product performance (mocked, as real product data may not be available)
const productData = [
  { product: 'Savings', customers: 25420, growth: '+12%' },
  { product: 'Current', customers: 18750, growth: '+8%' },
  { product: 'Loans', customers: 12340, growth: '+15%' },
  { product: 'Cards', customers: 31200, growth: '+20%' },
  { product: 'Investments', customers: 8950, growth: '+25%' },
];

export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState('6m');
  const { primaryColor } = useTenantBranding();
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await apiClient.get('/user/user/tenant');
        const data = response.data;
        let usersData: any[] = [];
        if (Array.isArray(data)) usersData = data;
        else if (Array.isArray(data.users)) usersData = data.users;
        else if (Array.isArray(data.data)) usersData = data.data;
        setUsers(usersData);
      } catch (e) {
                console.error('Error fetching users:', e);

        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch transactions
  useEffect(() => {
    const fetchAllTransactions = async () => {
      setTransactionsLoading(true);
      try {
        let allTxns: any[] = [];
        let page = 1;
        const limit = 100;
        let keepGoing = true;
        while (keepGoing) {
          const response = await apiClient.get(`/ledger/txn/`);
          const data = response.data;
          let txns: any[] = [];
          if (Array.isArray(data.transactions)) txns = data.transactions;
          else if (Array.isArray(data.data)) txns = data.data;
          allTxns = allTxns.concat(txns);
          if (!txns.length || txns.length < limit) {
            keepGoing = false;
          } else {
            page++;
            console.log(`Fetched page ${page} of transactions`);
          }
        }
        setTransactions(allTxns);
      } catch (e) {
                console.error('Error fetching users:', e);

        setTransactions([]);
      } finally {
        setTransactionsLoading(false);
      }
    };
    fetchAllTransactions();
    const interval = setInterval(fetchAllTransactions, 30000);
    return () => clearInterval(interval);
  }, []);

  // Metrics
  const totalUsers = users.length;
  const totalTransactions = transactions.length;
  const totalRevenue = transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const performanceData = useMemo(() => groupByMonth(transactions), [transactions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background ">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <BarChart3 className="w-8 h-8 " style={{ color: primaryColor }} />
                Analytics
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive banking analytics and insights
              </p>
            </div>
            <Tabs value={timeRange} onValueChange={setTimeRange}>
              <TabsList>
                <TabsTrigger value="1m">1M</TabsTrigger>
                <TabsTrigger value="3m">3M</TabsTrigger>
                <TabsTrigger value="6m">6M</TabsTrigger>
                <TabsTrigger value="1y">1Y</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Activity className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactionsLoading ? <span className="animate-pulse">...</span> : totalTransactions.toLocaleString()}</div>
              {/* You can add growth % here if you compute it */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactionsLoading ? <span className="animate-pulse">...</span> : `₦${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersLoading ? <span className="animate-pulse">...</span> : totalUsers.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg. Transaction Value</CardTitle>
              <TrendingUp className="w-4 h-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactionsLoading ? <span className="animate-pulse">...</span> : `₦${avgTransactionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>6-month performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="transactions" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Transactions"
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="Revenue (₦)"
                />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Active Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Channel Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Channels</CardTitle>
              <CardDescription>Distribution by channel type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => props.percent !== undefined ? `${props.name}: ${(props.percent * 100).toFixed(0)}%` : props.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Product Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
              <CardDescription>Customer distribution by product</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {productData.map((item) => (
                  <div key={item.product} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <span className="font-medium text-foreground">
                        {item.product}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        {item.customers.toLocaleString()}
                      </span>
                      <span className="text-green-600 text-sm font-medium">
                        {item.growth}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
