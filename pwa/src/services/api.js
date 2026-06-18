// 54Bank API Client — handles auth, retries, offline queuing, multi-tenant context
const API_BASE = window.location.origin + '/api';

class BankAPI {
  constructor() {
    this.token = localStorage.getItem('54bank_token') || '';
    this.tenantId = localStorage.getItem('54bank_tenant_id') || 'platform';
    this.tenantFeatures = null;
    this.tenantBranding = null;
    this.offlineQueue = [];
  }

  setTenantId(tenantId) {
    this.tenantId = tenantId;
    localStorage.setItem('54bank_tenant_id', tenantId);
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('54bank_token', token);
  }

  async request(method, path, body = null) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Trace-Id': crypto.randomUUID(),
      'X-Tenant-Id': this.tenantId,
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    // Retry with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${API_BASE}${path}`, opts);
        if (res.status === 401) {
          this.token = '';
          localStorage.removeItem('54bank_token');
          window.dispatchEvent(new Event('auth-required'));
          throw new Error('Unauthorized');
        }
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After') || 1;
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
        return await res.json();
      } catch (err) {
        if (!navigator.onLine && method === 'POST') {
          this.queueOffline(path, body);
          return { queued: true, offline: true };
        }
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
      }
    }
  }

  queueOffline(path, body) {
    this.offlineQueue.push({ url: `${API_BASE}${path}`, payload: body, token: this.token, timestamp: Date.now() });
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.sync.register('agent-query-sync'));
    }
  }

  // Agent endpoints
  async agentQuery(agentName, query, context = {}) {
    return this.request('POST', `/agent/${agentName}/query`, { query, context });
  }

  async agentOpenAccount(customerData) {
    return this.request('POST', '/agent/account-opening/open-account', customerData);
  }

  async agentInvestigate(transactionId, params = {}) {
    return this.request('POST', '/agent/transaction-investigation/investigate', { transaction_id: transactionId, ...params });
  }

  async agentPrepareReturn(returnType, period) {
    return this.request('POST', '/agent/regulatory-returns/prepare-return', { return_type: returnType, period });
  }

  async agentAssessLoan(loanData) {
    return this.request('POST', '/agent/loan-origination/assess-loan', loanData);
  }

  async agentAsk(question) {
    return this.request('POST', '/agent/nl-reporting/ask', { query: question });
  }

  async agentCustomer360(customerId) {
    return this.request('POST', '/agent/customer-360/customer-view', { customer_id: customerId });
  }

  async agentLiquidityPosition() {
    return this.request('POST', '/agent/cash-management/liquidity-position', {});
  }

  async agentDetectFraud(params) {
    return this.request('POST', '/agent/fraud-detection/detect-patterns', params);
  }

  async agentReconcile(params) {
    return this.request('POST', '/agent/reconciliation/reconcile', params);
  }

  // Graph endpoints
  async getCoaGraph() { return this.request('GET', '/neo4j/coa/graph'); }
  async getBaselIII() { return this.request('GET', '/neo4j/coa/basel-iii'); }
  async getLiquidity() { return this.request('GET', '/neo4j/coa/liquidity'); }
  async getPageRank() { return this.request('GET', '/neo4j/coa/pagerank'); }
  async semanticSearch(query) { return this.request('POST', '/qdrant/search/semantic', { query }); }

  // KPI Dashboard endpoints
  async getDashboardSummary() { return this.request('GET', '/dashboard/summary'); }
  async getDashboardRoles() { return this.request('GET', '/dashboard/roles'); }
  async getDashboardRole(role) { return this.request('GET', `/dashboard/role/${role}`); }
  async getDashboardAgents() { return this.request('GET', '/dashboard/agents'); }
  async askDashboard(question, role) { return this.request('POST', '/dashboard/ask', { query: question, role }); }
  async exportDashboard(role, format) { return this.request('POST', '/dashboard/export', { role, format }); }
  async refreshDashboard() { return this.request('GET', '/dashboard/refresh'); }

  // Tenant management
  async getTenantFeatures() {
    const data = await this.request('GET', '/tenant/v1/tenant/features');
    this.tenantFeatures = data;
    return data;
  }
  async getTenantBranding() {
    const data = await this.request('GET', '/tenant/v1/tenant/branding');
    this.tenantBranding = data;
    return data;
  }
  async getTenantUsage() { return this.request('GET', '/tenant/v1/tenant/usage'); }
  async getTiers() { return this.request('GET', '/tenant/v1/tiers'); }
  async listTenants() { return this.request('GET', '/tenant/v1/tenants'); }
  async createTenant(data) { return this.request('POST', '/tenant/v1/tenants', data); }
  async updateTenantTier(tenantId, tier) { return this.request('POST', `/tenant/v1/tenants/${tenantId}/tier`, { tier }); }
  async updateTenantBranding(tenantId, branding) { return this.request('POST', `/tenant/v1/tenants/${tenantId}/branding`, branding); }

  isFeatureAllowed(feature) {
    if (!this.tenantFeatures) return true;
    const f = this.tenantFeatures.features || {};
    if (feature.startsWith('agent:')) return (f.agents || []).includes(feature.slice(6));
    if (feature.startsWith('kpi:')) return (f.kpi_roles || []).includes(feature.slice(4));
    if (feature.startsWith('graph:')) return (f.graph_tools || []).includes(feature.slice(6));
    return (f.features || []).includes(feature);
  }

  // Core banking
  async getAccounts() { return this.request('GET', '/core-banking/list'); }
  async getGLAccounts() { return this.request('GET', '/gl-engine/chart-of-accounts'); }
  async getAccountStatement(accountId) { return this.request('GET', `/accounts/v1/statements/${accountId}`); }
  async getFixedDeposits() { return this.request('GET', '/deposits/v1/fixed'); }
  async getSavingsProducts() { return this.request('GET', '/products/v1/savings'); }

  // Payments
  async getPayments() { return this.request('GET', '/payments/v1/transactions'); }
  async createPayment(data) { return this.request('POST', '/payments/v1/transactions', data); }
  async getTransfers() { return this.request('GET', '/transfers/v1/list'); }
  async initiateTransfer(data) { return this.request('POST', '/transfers/v1/initiate', data); }
  async getBulkPayments() { return this.request('GET', '/payments/v1/bulk'); }

  // Loans
  async getLoans() { return this.request('GET', '/loans/v1/applications'); }
  async createLoanApplication(data) { return this.request('POST', '/loans/v1/applications', data); }
  async getLoanSchedule(loanId) { return this.request('GET', `/loans/v1/schedule/${loanId}`); }
  async getLoanRepayments(loanId) { return this.request('GET', `/loans/v1/repayments/${loanId}`); }

  // Cards
  async getCards() { return this.request('GET', '/cards/v1/list'); }
  async requestCard(data) { return this.request('POST', '/cards/v1/request', data); }
  async freezeCard(cardId) { return this.request('POST', `/cards/v1/${cardId}/freeze`); }
  async getCardTransactions(cardId) { return this.request('GET', `/cards/v1/${cardId}/transactions`); }

  // KYC
  async getKYCStatus() { return this.request('GET', '/kyc/v1/status'); }
  async submitKYCDocuments(data) { return this.request('POST', '/kyc/v1/documents', data); }
  async getLivenessSession() { return this.request('POST', '/kyc/v1/liveness/session'); }
  async uploadLivenessFrame(sessionId, frame) { return this.request('POST', `/kyc/v1/liveness/${sessionId}/frame`, { frame }); }

  // Notifications
  async getNotifications() { return this.request('GET', '/notifications/v1/list'); }
  async markRead(notificationId) { return this.request('POST', `/notifications/v1/${notificationId}/read`); }

  // Profile
  async getProfile() { return this.request('GET', '/profile/v1/me'); }
  async updateProfile(data) { return this.request('PUT', '/profile/v1/me', data); }
  async changePassword(data) { return this.request('POST', '/profile/v1/change-password', data); }

  // Beneficiaries
  async getBeneficiaries() { return this.request('GET', '/beneficiaries/v1/list'); }
  async addBeneficiary(data) { return this.request('POST', '/beneficiaries/v1/add', data); }
  async deleteBeneficiary(id) { return this.request('DELETE', `/beneficiaries/v1/${id}`); }

  // FX
  async getFXRates() { return this.request('GET', '/fx/v1/rates'); }
  async executeFXTrade(data) { return this.request('POST', '/fx/v1/trade', data); }

  // Bills
  async getBillers() { return this.request('GET', '/bills/v1/billers'); }
  async payBill(data) { return this.request('POST', '/bills/v1/pay', data); }
  async getAirtimeProviders() { return this.request('GET', '/bills/v1/airtime/providers'); }
  async buyAirtime(data) { return this.request('POST', '/bills/v1/airtime/purchase', data); }

  // Insurance
  async getInsuranceProducts() { return this.request('GET', '/insurance/v1/products'); }
  async getInsurancePolicies() { return this.request('GET', '/insurance/v1/policies'); }

  // Investments
  async getInvestments() { return this.request('GET', '/investments/v1/portfolio'); }
  async getInvestmentProducts() { return this.request('GET', '/investments/v1/products'); }

  // Statements & Reports
  async downloadStatement(accountId, format) { return this.request('POST', `/statements/v1/generate`, { accountId, format }); }
  async getTransactionHistory(params) { return this.request('GET', `/transactions/v1/history?${new URLSearchParams(params)}`); }
}

export const api = new BankAPI();
export default api;
