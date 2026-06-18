// 54Bank PWA — Main Application Shell
import { api } from './services/api.js';
import { agentService } from './services/agent.js';

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    console.log('54Bank SW registered:', reg.scope);
  });
}

const AGENTS = [
  { id: 'nl-reporting', name: 'Financial Reporting', icon: 'chart-bar', desc: 'Ask financial questions in plain English' },
  { id: 'account-opening', name: 'Account Opening', icon: 'user-plus', desc: 'Conversational account opening' },
  { id: 'transaction-investigation', name: 'Transaction Investigation', icon: 'search', desc: 'Trace & investigate transactions' },
  { id: 'regulatory-returns', name: 'Regulatory Returns', icon: 'file-text', desc: 'Prepare CBN MBR, SRF, eFASS' },
  { id: 'loan-origination', name: 'Loan Origination', icon: 'credit-card', desc: 'Risk assessment & credit memo' },
  { id: 'customer-360', name: 'Customer 360', icon: 'users', desc: 'Unified customer view' },
  { id: 'dormancy-prevention', name: 'Dormancy Prevention', icon: 'bell', desc: 'Churn risk & retention' },
  { id: 'cash-management', name: 'Cash Management', icon: 'dollar-sign', desc: 'Liquidity & CRR monitoring' },
  { id: 'fraud-detection', name: 'Fraud Detection', icon: 'shield', desc: 'Pattern detection & network analysis' },
  { id: 'reconciliation', name: 'Reconciliation', icon: 'check-circle', desc: 'GL to sub-ledger reconciliation' },
];

const GRAPH_TOOLS = [
  { id: 'coa-graph', name: 'COA Graph', desc: 'Interactive Chart of Accounts relationship graph' },
  { id: 'pagerank', name: 'PageRank', desc: 'Systemic importance ranking of accounts' },
  { id: 'basel-iii', name: 'Basel III', desc: 'Capital adequacy & risk metrics' },
  { id: 'liquidity', name: 'Liquidity', desc: 'Liquidity coverage ratio analysis' },
  { id: 'semantic-search', name: 'Semantic Search', desc: 'Search financial data by meaning' },
];

class App {
  constructor() {
    this.currentPage = 'home';
    this.currentAgent = null;
    this.currentRole = 'board';
    this.conversations = [];
    this.dashboardData = null;
    this.dashboardSummary = null;
    this.isOnline = navigator.onLine;
    this.tenantBranding = null;
    this.tenantFeatures = null;
    this.tenantTier = 'starter';
    this.sidebarOpen = false;
    this.recentPages = JSON.parse(localStorage.getItem('54bank_recent_pages') || '[]');
    window.app = this;
    this.init();
  }

  init() {
    window.addEventListener('online', () => { this.isOnline = true; this.render(); });
    window.addEventListener('offline', () => { this.isOnline = false; this.render(); });
    window.addEventListener('auth-required', () => { this.currentPage = 'login'; this.render(); });
    window.addEventListener('hashchange', () => this.handleRoute());

    agentService.subscribe((event) => {
      this.conversations = agentService.getHistory();
      this.render();
    });

    this.loadTenantContext();
    this.handleRoute();
  }

  async loadTenantContext() {
    try {
      const [features, branding] = await Promise.all([
        api.getTenantFeatures().catch(() => null),
        api.getTenantBranding().catch(() => null),
      ]);
      if (features) {
        this.tenantFeatures = features.features || {};
        this.tenantTier = features.tier || 'starter';
      }
      if (branding) {
        this.tenantBranding = branding.branding || {};
        this.applyBranding(this.tenantBranding);
      }
      this.render();
    } catch (e) {
      // Use defaults if tenant service is unavailable
    }
  }

  applyBranding(branding) {
    if (!branding) return;
    const root = document.documentElement;
    if (branding.primary_color) root.style.setProperty('--primary-color', branding.primary_color);
    if (branding.secondary_color) root.style.setProperty('--secondary-color', branding.secondary_color);
    if (branding.accent_color) root.style.setProperty('--accent-color', branding.accent_color);
    if (branding.custom_css) {
      let styleEl = document.getElementById('tenant-custom-css');
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'tenant-custom-css'; document.head.appendChild(styleEl); }
      styleEl.textContent = branding.custom_css;
    }
    if (branding.app_name) document.title = branding.app_name;
  }

  isFeatureAllowed(feature) {
    return api.isFeatureAllowed(feature);
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    const parts = hash.split('/');
    this.currentPage = parts[0];
    if (parts[0] === 'agent' && parts[1]) this.currentAgent = parts[1];
    if (parts[0] === 'kpi' && parts[1]) this.currentRole = parts[1];
    if (parts[0] === 'kpi' && !parts[1]) this.loadDashboardSummary();
    if (parts[0] === 'kpi' && parts[1]) this.loadRoleDashboard(parts[1]);
    this.render();
  }

  render() {
    const root = document.getElementById('root');
    root.innerHTML = `
      ${this.renderHeader()}
      <main class="main-content">
        ${this.renderPage()}
      </main>
      ${this.renderNav()}
      <style>${this.getStyles()}</style>
    `;
    this.attachEvents();
  }

  renderHeader() {
    const appName = (this.tenantBranding && this.tenantBranding.app_name) || '54Bank';
    const logoUrl = this.tenantBranding && this.tenantBranding.logo_url;
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${appName}" class="header-logo" />` : '';
    return `
      <header class="app-header">
        <div class="header-left">
          ${logoHtml}<a href="#home" class="logo">${appName}</a>
        </div>
        <div class="header-right">
          <span class="tier-badge">${this.tenantTier}</span>
          <span class="status-dot ${this.isOnline ? 'online' : 'offline'}"></span>
          <span class="status-text">${this.isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </header>
    `;
  }

  renderNav() {
    return `
      <nav class="bottom-nav">
        <a href="#home" class="nav-item ${this.currentPage === 'home' ? 'active' : ''}">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span class="nav-label">Home</span>
        </a>
        <a href="#agents" class="nav-item ${this.currentPage === 'agents' ? 'active' : ''}">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-7-7H1m22 0h-4m-1.5-6.5L15 5m-6 14l-2.5-2.5M19.5 5L17 7.5M5 19.5L7.5 17"/></svg><span class="nav-label">Agents</span>
        </a>
        <a href="#kpi" class="nav-item ${this.currentPage === 'kpi' ? 'active' : ''}">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10m-6 10V4M6 20v-6"/></svg><span class="nav-label">KPIs</span>
        </a>
        <a href="#graph" class="nav-item ${this.currentPage === 'graph' ? 'active' : ''}">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M8.6 7.4L15.4 16.6M8.6 4.6L15.4 4.6"/></svg><span class="nav-label">Graph</span>
        </a>
        <button class="nav-item" onclick="window.app.toggleSidebar()">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg><span class="nav-label">More</span>
        </button>
      </nav>
      ${this.renderSideDrawer()}
    `;
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.render();
  }

  renderSideDrawer() {
    const isDesktop = window.innerWidth >= 768;
    if (!this.sidebarOpen && !isDesktop) return '';
    const categories = [
      { name: 'Core Banking', icon: 'bank', items: [
        { label: 'Account Opening', hash: 'account-opening' },
        { label: 'Customer 360', hash: 'customer-360' },
        { label: 'Deposits', hash: 'deposits' },
        { label: 'Standing Orders', hash: 'standing-orders' },
        { label: 'Branch Ops', hash: 'branch-ops' },
      ]},
      { name: 'Payments', icon: 'arrow-swap', items: [
        { label: 'Payments Hub', hash: 'payments-hub' },
        { label: 'Bulk Payments', hash: 'bulk-payments' },
        { label: 'QR Payments', hash: 'qr-payments' },
        { label: 'Remittance', hash: 'remittance' },
        { label: 'SWIFT', hash: 'swift' },
      ]},
      { name: 'Cards', icon: 'credit-card', items: [
        { label: 'Card Management', hash: 'card-management' },
        { label: 'Virtual Cards', hash: 'virtual-cards' },
        { label: 'Card Tokens', hash: 'card-tokens' },
      ]},
      { name: 'Lending', icon: 'dollar', items: [
        { label: 'Loan Origination', hash: 'loan-origination' },
        { label: 'Credit Scoring', hash: 'credit-scoring' },
        { label: 'Collections', hash: 'collections' },
        { label: 'Disbursement', hash: 'disbursement' },
      ]},
      { name: 'Treasury & FX', icon: 'trending-up', items: [
        { label: 'Treasury', hash: 'treasury' },
        { label: 'FX Rates', hash: 'fx-rates' },
        { label: 'Money Market', hash: 'money-market' },
        { label: 'Investments', hash: 'investments' },
      ]},
      { name: 'Risk & Compliance', icon: 'shield', items: [
        { label: 'KYC/KYB', hash: 'kyc' },
        { label: 'AML Screening', hash: 'aml' },
        { label: 'Fraud Detection', hash: 'fraud' },
        { label: 'Audit Trail', hash: 'audit' },
        { label: 'Regulatory Returns', hash: 'regulatory' },
      ]},
      { name: 'Insurance', icon: 'shield-check', items: [
        { label: 'Agricultural Insurance', hash: 'agri-insurance' },
        { label: 'Claims', hash: 'claims' },
        { label: 'Policy Mgmt', hash: 'policies' },
      ]},
      { name: 'Agent Banking', icon: 'users', items: [
        { label: 'Agent Network', hash: 'agents' },
        { label: 'Float Mgmt', hash: 'float' },
        { label: 'Commission', hash: 'commission' },
      ]},
      { name: 'Administration', icon: 'settings', items: [
        { label: 'User Management', hash: 'users' },
        { label: 'Roles & Permissions', hash: 'roles' },
        { label: 'Tenant Config', hash: 'tenant-config' },
        { label: 'Feature Flags', hash: 'feature-flags' },
        { label: 'System Health', hash: 'system-health' },
      ]},
    ];
    return `
      <div class="sidebar-overlay" onclick="window.app.toggleSidebar()"></div>
      <aside class="sidebar-drawer open">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Navigation</h2>
          <button class="sidebar-close" onclick="window.app.toggleSidebar()">&times;</button>
        </div>
        <div class="sidebar-search">
          <input type="text" placeholder="Search pages..." class="sidebar-search-input" id="pwa-nav-search" oninput="window.app.filterSidebarNav(this.value)" />
        </div>
        <nav class="sidebar-nav" id="pwa-sidebar-nav">
          ${categories.map(cat => `
            <div class="sidebar-category">
              <div class="sidebar-cat-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="sidebar-cat-name">${cat.name}</span>
                <span class="sidebar-cat-count">${cat.items.length}</span>
                <span class="sidebar-chevron">&#9656;</span>
              </div>
              <div class="sidebar-cat-items">
                ${cat.items.map(item => `
                  <a href="#${item.hash}" class="sidebar-item" onclick="window.app.toggleSidebar()">${item.label}</a>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-footer-info">${categories.reduce((sum, c) => sum + c.items.length, 0)} pages across ${categories.length} categories</div>
        </div>
      </aside>
    `;
  }

  filterSidebarNav(query) {
    const nav = document.getElementById('pwa-sidebar-nav');
    if (!nav) return;
    const items = nav.querySelectorAll('.sidebar-item');
    const categories = nav.querySelectorAll('.sidebar-category');
    query = query.toLowerCase();
    categories.forEach(cat => {
      let visible = 0;
      cat.querySelectorAll('.sidebar-item').forEach(item => {
        const match = item.textContent.toLowerCase().includes(query);
        item.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      cat.style.display = visible > 0 || !query ? '' : 'none';
      if (query) cat.classList.add('open');
    });
  }

  renderPage() {
    switch (this.currentPage) {
      case 'home': return this.renderHome();
      case 'agents': return this.renderAgents();
      case 'agent': return this.renderAgentDetail();
      case 'kpi': return this.renderKPIDashboard();
      case 'graph': return this.renderGraph();
      case 'chat': return this.renderChat();
      case 'settings': return this.renderSettings();
      case 'login': return this.renderLogin();
      default: return this.renderHome();
    }
  }

  renderHome() {
    return `
      <div class="page home-page">
        <h1 class="page-title">Welcome to 54Bank</h1>
        <p class="page-subtitle">AI-Powered Intelligent Banking Platform</p>

        <div class="quick-actions">
          <h2>Quick Actions</h2>
          <div class="action-grid">
            <button class="action-card" data-action="ask" data-agent="nl-reporting">
              <span class="action-icon">&#x1F4CA;</span>
              <span class="action-title">Ask a Question</span>
              <span class="action-desc">Natural language financial queries</span>
            </button>
            <button class="action-card" data-action="navigate" data-target="agent/account-opening">
              <span class="action-icon">&#x1F464;</span>
              <span class="action-title">Open Account</span>
              <span class="action-desc">AI-guided account opening</span>
            </button>
            <button class="action-card" data-action="navigate" data-target="agent/loan-origination">
              <span class="action-icon">&#x1F4B0;</span>
              <span class="action-title">Loan Assessment</span>
              <span class="action-desc">Smart credit analysis</span>
            </button>
            <button class="action-card" data-action="navigate" data-target="kpi">
              <span class="action-icon">&#x1F4CA;</span>
              <span class="action-title">KPI Dashboard</span>
              <span class="action-desc">Stakeholder KPI metrics</span>
            </button>
            <button class="action-card" data-action="navigate" data-target="graph">
              <span class="action-icon">&#x1F578;</span>
              <span class="action-title">COA Graph</span>
              <span class="action-desc">Account relationship explorer</span>
            </button>
          </div>
        </div>

        <div class="dashboard-widgets">
          <h2>Dashboard</h2>
          <div class="widget-grid">
            <div class="widget">
              <h3>475</h3>
              <p>Active Services</p>
            </div>
            <div class="widget">
              <h3>10</h3>
              <p>AI Agents</p>
            </div>
            <div class="widget">
              <h3>5</h3>
              <p>Graph DBs</p>
            </div>
            <div class="widget">
              <h3>24/7</h3>
              <p>Monitoring</p>
            </div>
          </div>
        </div>

        <div class="recent-conversations">
          <h2>Recent Agent Activity</h2>
          ${this.conversations.length === 0
            ? '<p class="empty-state">No recent agent conversations. Try asking a question!</p>'
            : this.conversations.slice(0, 5).map((c) => `
              <div class="conversation-item ${c.status}">
                <div class="conv-header">
                  <span class="conv-agent">${c.agentType}</span>
                  <span class="conv-status">${c.status}</span>
                </div>
                <p class="conv-question">${c.question.slice(0, 100)}</p>
                <span class="conv-time">${new Date(c.startTime).toLocaleTimeString()}</span>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  }

  renderAgents() {
    return `
      <div class="page agents-page">
        <h1 class="page-title">AI Banking Agents</h1>
        <p class="page-subtitle">10 specialized agents for core banking operations</p>
        <div class="agent-grid">
          ${AGENTS.map((a) => {
            const allowed = this.isFeatureAllowed('agent:' + a.id);
            return `
            <a href="${allowed ? '#agent/' + a.id : '#'}" class="agent-card ${!allowed ? 'locked' : ''}">
              <div class="agent-icon">${this.getAgentEmoji(a.id)}</div>
              <h3>${a.name}</h3>
              <p>${a.desc}</p>
              ${!allowed ? '<span class="lock-badge">Upgrade Plan</span>' : ''}
            </a>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderAgentDetail() {
    const agent = AGENTS.find((a) => a.id === this.currentAgent);
    if (!agent) return '<p>Agent not found</p>';

    const agentConvos = this.conversations.filter((c) => c.agentType === agent.id);

    return `
      <div class="page agent-detail-page">
        <div class="agent-header">
          <a href="#agents" class="back-btn">&larr; Back</a>
          <h1>${this.getAgentEmoji(agent.id)} ${agent.name}</h1>
          <p>${agent.desc}</p>
        </div>

        <div class="agent-chat">
          <div class="chat-messages" id="chat-messages">
            ${agentConvos.map((c) => `
              <div class="message user-message">
                <p>${c.question}</p>
              </div>
              <div class="message agent-message ${c.status}">
                ${c.status === 'thinking' ? '<div class="thinking-dots"><span></span><span></span><span></span></div>' : ''}
                ${c.status === 'complete' ? `
                  <div class="agent-response">
                    ${c.steps ? `<div class="steps-summary">${c.steps.length} reasoning steps completed</div>` : ''}
                    <pre>${JSON.stringify(c.result, null, 2)}</pre>
                  </div>
                ` : ''}
                ${c.status === 'error' ? `<p class="error-text">Error: ${c.error}</p>` : ''}
              </div>
            `).join('')}
          </div>

          <div class="chat-input-container">
            <input type="text" id="agent-input" class="chat-input" placeholder="Ask ${agent.name}..." />
            <button id="agent-send" class="send-btn">Send</button>
          </div>
        </div>
      </div>
    `;
  }

  renderGraph() {
    return `
      <div class="page graph-page">
        <h1 class="page-title">Graph Intelligence</h1>
        <p class="page-subtitle">COA relationship graph, analytics, and semantic search</p>
        <div class="graph-tools">
          ${GRAPH_TOOLS.map((t) => {
            const allowed = this.isFeatureAllowed('graph:' + t.id);
            return `
            <div class="graph-tool-card ${!allowed ? 'locked' : ''}" data-tool="${t.id}">
              <h3>${t.name}</h3>
              <p>${t.desc}</p>
              ${allowed ? `<button class="tool-btn" data-tool="${t.id}">Launch</button>` : '<span class="lock-badge">Upgrade Plan</span>'}
            </div>`;
          }).join('')}
        </div>
        <div class="graph-results" id="graph-results"></div>
      </div>
    `;
  }

  async loadDashboardSummary() {
    try {
      const data = await api.request('GET', '/dashboard/summary');
      this.dashboardSummary = data;
      this.render();
    } catch (e) {
      this.dashboardSummary = this.getDefaultSummary();
      this.render();
    }
  }

  async loadRoleDashboard(role) {
    this.dashboardData = this.getDefaultRoleData(role);
    try {
      const data = await api.request('GET', `/dashboard/role/${role}`);
      this.dashboardData = data;
    } catch (e) {
      // Already set to defaults above
    }
    this.render();
  }

  getDefaultSummary() {
    return { summary: {
      board: { title: 'Board / ALCO', red: 1, amber: 2, green: 4, total: 7 },
      cfo: { title: 'CFO / Treasury', red: 0, amber: 3, green: 5, total: 8 },
      cro: { title: 'Chief Risk Officer', red: 1, amber: 1, green: 5, total: 7 },
      coo: { title: 'Chief Operating Officer', red: 0, amber: 2, green: 5, total: 7 },
      cto: { title: 'Chief Technology Officer', red: 0, amber: 1, green: 6, total: 7 },
      compliance: { title: 'Compliance Officer', red: 0, amber: 1, green: 5, total: 6 },
      rm: { title: 'Relationship Manager', red: 0, amber: 1, green: 5, total: 6 },
      branch: { title: 'Branch Manager', red: 0, amber: 1, green: 5, total: 6 },
    }};
  }

  getDefaultRoleData(role) {
    const defaults = {
      board: { title: 'Board / ALCO Dashboard', kpis: [
        { id: 'car', name: 'Capital Adequacy Ratio', value: 14.2, target: 15.0, unit: '%', status: 'amber' },
        { id: 'roe', name: 'Return on Equity', value: 18.5, target: 20.0, unit: '%', status: 'amber' },
        { id: 'roa', name: 'Return on Assets', value: 2.8, target: 3.0, unit: '%', status: 'amber' },
        { id: 'nim', name: 'Net Interest Margin', value: 6.7, target: 7.0, unit: '%', status: 'green' },
        { id: 'npl', name: 'Non-Performing Loan Ratio', value: 4.2, target: 3.0, unit: '%', status: 'amber' },
        { id: 'cost_income', name: 'Cost-to-Income Ratio', value: 58.3, target: 55.0, unit: '%', status: 'green' },
        { id: 'systemic_risk', name: 'Systemic Risk Score', value: 0.42, target: 0.0, unit: 'score', status: 'green' },
      ]},
      cfo: { title: 'CFO / Treasury Dashboard', kpis: [
        { id: 'liquidity_ratio', name: 'Liquidity Coverage Ratio', value: 42.6, target: 100.0, unit: '%', status: 'red' },
        { id: 'crr_compliance', name: 'CRR Compliance', value: 33.1, target: 32.5, unit: '%', status: 'green' },
        { id: 'deposit_growth', name: 'Deposit Growth Rate', value: 8.7, target: 12.0, unit: '%', status: 'amber' },
        { id: 'loan_deposit_ratio', name: 'Loan-to-Deposit Ratio', value: 62.4, target: 65.0, unit: '%', status: 'green' },
        { id: 'recon_breaks', name: 'Outstanding Recon Breaks', value: 12, target: 0, unit: 'count', status: 'green' },
      ]},
      cro: { title: 'Chief Risk Officer Dashboard', kpis: [
        { id: 'ecl_coverage', name: 'ECL Coverage Ratio', value: 75.0, target: 80.0, unit: '%', status: 'green' },
        { id: 'fraud_alerts', name: 'Active Fraud Alerts', value: 5, target: 0, unit: 'count', status: 'green' },
        { id: 'stage3_ratio', name: 'IFRS9 Stage 3 Ratio', value: 4.8, target: 3.0, unit: '%', status: 'amber' },
        { id: 'concentration_risk', name: 'Sector Concentration', value: 2, target: 0, unit: 'count', status: 'green' },
      ]},
      coo: { title: 'COO Dashboard', kpis: [
        { id: 'service_uptime', name: 'Platform Uptime', value: 99.92, target: 99.95, unit: '%', status: 'amber' },
        { id: 'txn_volume', name: 'Daily Transaction Volume', value: 847523, target: 1000000, unit: 'count', status: 'green' },
        { id: 'avg_response_time', name: 'Avg Response Time', value: 245, target: 200, unit: 'ms', status: 'green' },
      ]},
      cto: { title: 'CTO Dashboard', kpis: [
        { id: 'total_services', name: 'Total Active Services', value: 485, target: 485, unit: 'count', status: 'green' },
        { id: 'error_rate', name: 'Error Rate', value: 0.3, target: 0.1, unit: '%', status: 'green' },
        { id: 'security_score', name: 'Security Score', value: 93, target: 95, unit: '%', status: 'amber' },
        { id: 'agent_availability', name: 'AI Agent Availability', value: 100, target: 100, unit: '%', status: 'green' },
      ]},
      compliance: { title: 'Compliance Dashboard', kpis: [
        { id: 'kyc_completion', name: 'KYC Completion Rate', value: 97.8, target: 100, unit: '%', status: 'amber' },
        { id: 'cbn_returns_due', name: 'CBN Returns Due', value: 2, target: 0, unit: 'count', status: 'amber' },
        { id: 'data_quality', name: 'Data Quality Score', value: 94.2, target: 95, unit: '%', status: 'amber' },
      ]},
      rm: { title: 'Relationship Manager Dashboard', kpis: [
        { id: 'active_customers', name: 'Active Customers', value: 34521, target: 0, unit: 'count', status: 'green' },
        { id: 'churn_risk_high', name: 'High Churn Risk', value: 342, target: 0, unit: 'count', status: 'amber' },
        { id: 'nps_score', name: 'Net Promoter Score', value: 67, target: 70, unit: 'score', status: 'amber' },
      ]},
      branch: { title: 'Branch Manager Dashboard', kpis: [
        { id: 'daily_transactions', name: 'Daily Transactions', value: 423, target: 500, unit: 'count', status: 'green' },
        { id: 'queue_wait_time', name: 'Queue Wait Time', value: 12, target: 10, unit: 'min', status: 'green' },
        { id: 'customer_satisfaction', name: 'Customer Satisfaction', value: 88, target: 90, unit: '%', status: 'amber' },
      ]},
    };
    return defaults[role] || defaults.board;
  }

  renderKPIDashboard() {
    const roleEmojis = { board: '&#x1F3DB;', cfo: '&#x1F4B0;', cro: '&#x1F6E1;', coo: '&#x2699;', cto: '&#x1F4BB;', compliance: '&#x1F4DC;', rm: '&#x1F465;', branch: '&#x1F3E6;' };

    if (this.currentRole && window.location.hash.includes('/')) {
      const data = this.dashboardData || this.getDefaultRoleData(this.currentRole);
      const kpis = data.kpis || [];
      return `
        <div class="page kpi-page">
          <a href="#kpi" class="back-btn">&larr; All Dashboards</a>
          <h1 class="page-title">${data.title || this.currentRole}</h1>
          <div class="kpi-ask-bar">
            <input type="text" id="kpi-ask-input" class="chat-input" placeholder="Ask about these KPIs..." />
            <button id="kpi-ask-btn" class="send-btn">Ask AI</button>
          </div>
          <div class="kpi-grid">
            ${kpis.map((k) => `
              <div class="kpi-card kpi-${k.status}">
                <div class="kpi-header">
                  <span class="kpi-name">${k.name}</span>
                  <span class="kpi-status-dot kpi-dot-${k.status}"></span>
                </div>
                <div class="kpi-value">${typeof k.value === 'number' && k.value > 1000000 ? (k.value / 1000000000).toFixed(1) + 'B' : k.value}${k.unit === '%' ? '%' : ''}</div>
                <div class="kpi-target">Target: ${typeof k.target === 'number' && k.target > 1000000 ? (k.target / 1000000000).toFixed(1) + 'B' : k.target}${k.unit === '%' ? '%' : ''} ${k.unit !== '%' ? k.unit : ''}</div>
                <div class="kpi-bar-container">
                  <div class="kpi-bar kpi-bar-${k.status}" style="width: ${Math.min(100, k.target > 0 ? (k.value / k.target) * 100 : 100)}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
          <div id="kpi-ai-response" class="kpi-ai-response"></div>
        </div>
      `;
    }

    const summary = (this.dashboardSummary && this.dashboardSummary.summary) || this.getDefaultSummary().summary;
    return `
      <div class="page kpi-page">
        <h1 class="page-title">Stakeholder KPI Dashboards</h1>
        <p class="page-subtitle">Role-based performance monitoring powered by AI agents</p>
        <div class="kpi-summary-grid">
          ${Object.entries(summary).map(([role, data]) => `
            <a href="#kpi/${role}" class="kpi-role-card">
              <div class="kpi-role-icon">${roleEmojis[role] || '&#x1F4CA;'}</div>
              <h3>${data.title}</h3>
              <div class="kpi-role-stats">
                ${data.red > 0 ? `<span class="kpi-badge kpi-badge-red">${data.red} critical</span>` : ''}
                ${data.amber > 0 ? `<span class="kpi-badge kpi-badge-amber">${data.amber} warning</span>` : ''}
                <span class="kpi-badge kpi-badge-green">${data.green} on track</span>
              </div>
              <div class="kpi-role-total">${data.total} KPIs monitored</div>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderChat() {
    return `
      <div class="page chat-page">
        <h1 class="page-title">AI Assistant</h1>
        <p class="page-subtitle">Ask anything about your banking operations</p>

        <div class="unified-chat">
          <div class="chat-messages" id="unified-messages">
            ${this.conversations.map((c) => `
              <div class="message user-message"><p>${c.question.slice(0, 200)}</p></div>
              <div class="message agent-message ${c.status}">
                <span class="agent-badge">${c.agentType}</span>
                ${c.status === 'thinking' ? '<div class="thinking-dots"><span></span><span></span><span></span></div>' : ''}
                ${c.status === 'complete' ? `<pre>${JSON.stringify(c.result, null, 2).slice(0, 500)}</pre>` : ''}
                ${c.status === 'error' ? `<p class="error-text">${c.error}</p>` : ''}
              </div>
            `).join('')}
          </div>

          <div class="chat-input-container">
            <input type="text" id="unified-input" class="chat-input" placeholder="Ask anything..." />
            <button id="unified-send" class="send-btn">Ask</button>
          </div>
        </div>
      </div>
    `;
  }

  renderSettings() {
    const brandName = (this.tenantBranding && this.tenantBranding.app_name) || '54Bank';
    return `
      <div class="page settings-page">
        <h1 class="page-title">Settings</h1>
        <div class="settings-list">
          <div class="setting-item">
            <h3>API Token</h3>
            <input type="password" id="api-token" class="setting-input" value="${api.token}" placeholder="Enter Bearer token" />
            <button id="save-token" class="setting-btn">Save</button>
          </div>
          <div class="setting-item">
            <h3>Tenant</h3>
            <p>ID: <code>${api.tenantId}</code></p>
            <p>Tier: <span class="tier-badge">${this.tenantTier}</span></p>
            <p>Branding: ${brandName}</p>
            <input type="text" id="tenant-id-input" class="setting-input" value="${api.tenantId}" placeholder="Tenant ID" />
            <button id="switch-tenant" class="setting-btn">Switch Tenant</button>
          </div>
          <div class="setting-item">
            <h3>Notifications</h3>
            <button id="enable-push" class="setting-btn">Enable Push Notifications</button>
          </div>
          <div class="setting-item">
            <h3>Offline Mode</h3>
            <p>Cached queries: ${this.conversations.filter((c) => c.status === 'complete').length}</p>
            <button id="clear-cache" class="setting-btn">Clear Cache</button>
          </div>
          <div class="setting-item">
            <h3>Platform</h3>
            <p>Services: 476 | Agents: 10 | Version: 3.1.0 (Multi-Tenant)</p>
          </div>
          <div class="setting-item">
            <h3>Feature Access (${this.tenantTier} tier)</h3>
            <p>Agents: ${this.tenantFeatures ? (this.tenantFeatures.agents || []).length : 10}/10</p>
            <p>KPI Roles: ${this.tenantFeatures ? (this.tenantFeatures.kpi_roles || []).length : 8}/8</p>
            <p>Graph Tools: ${this.tenantFeatures ? (this.tenantFeatures.graph_tools || []).length : 5}/5</p>
            <p>White Label: ${this.tenantFeatures ? (this.tenantFeatures.white_label ? 'Yes' : 'No') : 'N/A'}</p>
          </div>
        </div>
      </div>
    `;
  }

  renderLogin() {
    return `
      <div class="page login-page">
        <div class="login-card">
          <h1>54Bank</h1>
          <p>Sign in to continue</p>
          <input type="text" id="login-username" class="login-input" placeholder="Username" />
          <input type="password" id="login-password" class="login-input" placeholder="Password" />
          <button id="login-btn" class="login-btn">Sign In</button>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // Agent send
    const agentInput = document.getElementById('agent-input');
    const agentSend = document.getElementById('agent-send');
    if (agentInput && agentSend) {
      const send = () => {
        const q = agentInput.value.trim();
        if (q) { agentService.ask(q, this.currentAgent); agentInput.value = ''; }
      };
      agentSend.addEventListener('click', send);
      agentInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    }

    // Unified chat
    const uInput = document.getElementById('unified-input');
    const uSend = document.getElementById('unified-send');
    if (uInput && uSend) {
      const send = () => {
        const q = uInput.value.trim();
        if (q) { agentService.ask(q); uInput.value = ''; }
      };
      uSend.addEventListener('click', send);
      uInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    }

    // KPI ask
    const kpiInput = document.getElementById('kpi-ask-input');
    const kpiBtn = document.getElementById('kpi-ask-btn');
    if (kpiInput && kpiBtn) {
      const ask = async () => {
        const q = kpiInput.value.trim();
        if (!q) return;
        kpiInput.value = '';
        const resp = document.getElementById('kpi-ai-response');
        if (resp) resp.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
        try {
          const result = await api.request('POST', '/dashboard/ask', { query: q, role: this.currentRole });
          if (resp) resp.innerHTML = `<div class="kpi-ai-answer"><h3>AI Answer</h3><pre>${JSON.stringify(result, null, 2)}</pre></div>`;
        } catch (e) {
          if (resp) resp.innerHTML = `<p class="error-text">Error: ${e.message}</p>`;
        }
      };
      kpiBtn.addEventListener('click', ask);
      kpiInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') ask(); });
    }

    // Quick actions
    document.querySelectorAll('[data-action="ask"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const agent = btn.dataset.agent;
        window.location.hash = `agent/${agent}`;
      });
    });
    document.querySelectorAll('[data-action="navigate"]').forEach((btn) => {
      btn.addEventListener('click', () => { window.location.hash = btn.dataset.target; });
    });

    // Graph tools
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tool = btn.dataset.tool;
        const results = document.getElementById('graph-results');
        if (results) results.innerHTML = '<p class="loading-text">Loading...</p>';
        try {
          let data;
          switch (tool) {
            case 'coa-graph': data = await api.getCoaGraph(); break;
            case 'pagerank': data = await api.getPageRank(); break;
            case 'basel-iii': data = await api.getBaselIII(); break;
            case 'liquidity': data = await api.getLiquidity(); break;
            case 'semantic-search':
              const q = prompt('Enter search query:');
              if (q) data = await api.semanticSearch(q);
              break;
          }
          if (results && data) results.innerHTML = `<pre class="graph-output">${JSON.stringify(data, null, 2)}</pre>`;
        } catch (err) {
          if (results) results.innerHTML = `<p class="error-text">Error: ${err.message}</p>`;
        }
      });
    });

    // Settings
    const saveToken = document.getElementById('save-token');
    if (saveToken) {
      saveToken.addEventListener('click', () => {
        const token = document.getElementById('api-token').value;
        api.setToken(token);
        alert('Token saved');
      });
    }

    // Tenant switch
    const switchTenant = document.getElementById('switch-tenant');
    if (switchTenant) {
      switchTenant.addEventListener('click', () => {
        const newTenantId = document.getElementById('tenant-id-input').value.trim();
        if (newTenantId) {
          api.setTenantId(newTenantId);
          this.loadTenantContext();
        }
      });
    }

    const enablePush = document.getElementById('enable-push');
    if (enablePush) {
      enablePush.addEventListener('click', async () => {
        if ('Notification' in window) {
          const perm = await Notification.requestPermission();
          alert(perm === 'granted' ? 'Notifications enabled' : 'Notifications denied');
        }
      });
    }

    // Login
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        const user = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;
        if (user && pass) {
          api.setToken(btoa(`${user}:${pass}`));
          this.currentPage = 'home';
          window.location.hash = 'home';
        }
      });
    }
  }

  getAgentEmoji(id) {
    const map = {
      'nl-reporting': '&#x1F4CA;', 'account-opening': '&#x1F464;',
      'transaction-investigation': '&#x1F50D;', 'regulatory-returns': '&#x1F4C4;',
      'loan-origination': '&#x1F4B0;', 'customer-360': '&#x1F465;',
      'dormancy-prevention': '&#x1F514;', 'cash-management': '&#x1F4B5;',
      'fraud-detection': '&#x1F6E1;', 'reconciliation': '&#x2705;',
    };
    return map[id] || '&#x1F916;';
  }

  getStyles() {
    return `
      :root { --primary: #1a237e; --primary-light: #3949ab; --accent: #ff6f00; --bg: #f5f5f5; --card-bg: #fff; --text: #212121; --text-secondary: #757575; --border: #e0e0e0; --success: #2e7d32; --error: #c62828; --radius: 12px; }
      .app-header { position: fixed; top: 0; left: 0; right: 0; height: 56px; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
      .logo { color: #fff; text-decoration: none; font-size: 1.4rem; font-weight: 700; letter-spacing: 1px; }
      .header-right { display: flex; align-items: center; gap: 8px; font-size: .85rem; }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; }
      .status-dot.online { background: #4caf50; }
      .status-dot.offline { background: #f44336; }
      .main-content { margin-top: 56px; margin-bottom: 64px; padding: 16px; max-width: 1200px; margin-left: auto; margin-right: auto; }
      .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 64px; background: #fff; display: flex; border-top: 1px solid var(--border); z-index: 100; }
      .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-decoration: none; color: var(--text-secondary); font-size: .7rem; transition: color .2s; }
      .nav-item.active { color: var(--primary); }
      .nav-icon { font-size: 1.4rem; margin-bottom: 2px; }
      .page-title { font-size: 1.5rem; font-weight: 700; color: var(--text); margin-bottom: 4px; }
      .page-subtitle { color: var(--text-secondary); margin-bottom: 24px; }
      .action-grid, .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
      .action-card, .agent-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; text-align: left; cursor: pointer; transition: box-shadow .2s, transform .1s; text-decoration: none; color: inherit; display: block; }
      .action-card:hover, .agent-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.1); transform: translateY(-2px); }
      .action-icon, .agent-icon { font-size: 2rem; margin-bottom: 8px; display: block; }
      .action-title, .agent-card h3 { font-weight: 600; margin-bottom: 4px; }
      .action-desc, .agent-card p { color: var(--text-secondary); font-size: .85rem; }
      .widget-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
      .widget { background: var(--primary); color: #fff; border-radius: var(--radius); padding: 16px; text-align: center; }
      .widget h3 { font-size: 1.8rem; font-weight: 700; }
      .widget p { font-size: .75rem; opacity: .8; }
      h2 { font-size: 1.1rem; margin: 24px 0 12px; color: var(--text); }
      .agent-header { margin-bottom: 16px; }
      .back-btn { color: var(--primary); text-decoration: none; font-size: .9rem; display: inline-block; margin-bottom: 8px; }
      .chat-messages { max-height: 60vh; overflow-y: auto; padding: 8px 0; }
      .message { margin: 8px 0; padding: 12px 16px; border-radius: var(--radius); max-width: 85%; word-wrap: break-word; }
      .user-message { background: var(--primary); color: #fff; margin-left: auto; }
      .agent-message { background: var(--card-bg); border: 1px solid var(--border); }
      .agent-message pre { font-size: .8rem; overflow-x: auto; white-space: pre-wrap; }
      .agent-badge { background: var(--primary-light); color: #fff; font-size: .7rem; padding: 2px 8px; border-radius: 10px; margin-bottom: 8px; display: inline-block; }
      .chat-input-container { display: flex; gap: 8px; padding: 12px 0; position: sticky; bottom: 64px; background: var(--bg); }
      .chat-input { flex: 1; padding: 12px 16px; border: 1px solid var(--border); border-radius: 24px; font-size: 1rem; outline: none; }
      .chat-input:focus { border-color: var(--primary); }
      .send-btn { padding: 12px 24px; background: var(--primary); color: #fff; border: none; border-radius: 24px; font-weight: 600; cursor: pointer; }
      .thinking-dots span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--primary-light); margin: 0 2px; animation: bounce .6s infinite alternate; }
      .thinking-dots span:nth-child(2) { animation-delay: .2s; }
      .thinking-dots span:nth-child(3) { animation-delay: .4s; }
      @keyframes bounce { to { transform: translateY(-6px); } }
      .graph-tools { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
      .graph-tool-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
      .tool-btn { margin-top: 8px; padding: 8px 16px; background: var(--primary); color: #fff; border: none; border-radius: 8px; cursor: pointer; }
      .graph-output { background: #263238; color: #e0e0e0; padding: 16px; border-radius: var(--radius); overflow-x: auto; font-size: .8rem; }
      .settings-list { display: flex; flex-direction: column; gap: 16px; }
      .setting-item { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
      .setting-input { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; margin: 8px 0; font-size: .9rem; }
      .setting-btn { padding: 8px 16px; background: var(--primary); color: #fff; border: none; border-radius: 8px; cursor: pointer; margin-top: 4px; }
      .login-page { display: flex; justify-content: center; align-items: center; min-height: 80vh; }
      .login-card { background: var(--card-bg); border-radius: var(--radius); padding: 32px; width: 100%; max-width: 400px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
      .login-card h1 { color: var(--primary); font-size: 2rem; margin-bottom: 8px; }
      .login-input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin: 8px 0; font-size: 1rem; }
      .login-btn { width: 100%; padding: 14px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 16px; }
      .conversation-item { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin: 8px 0; }
      .conv-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
      .conv-agent { font-weight: 600; font-size: .85rem; }
      .conv-status { font-size: .75rem; padding: 2px 8px; border-radius: 10px; }
      .conv-status { background: #e8f5e9; color: var(--success); }
      .conversation-item.thinking .conv-status { background: #fff3e0; color: var(--accent); }
      .conversation-item.error .conv-status { background: #ffebee; color: var(--error); }
      .conv-question { font-size: .85rem; color: var(--text-secondary); }
      .conv-time { font-size: .75rem; color: var(--text-secondary); }
      .empty-state { color: var(--text-secondary); font-style: italic; padding: 24px 0; text-align: center; }
      .error-text { color: var(--error); }
      .loading-text { color: var(--text-secondary); text-align: center; padding: 24px; }
      .steps-summary { font-size: .8rem; color: var(--success); margin-bottom: 8px; }
      .kpi-summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
      .kpi-role-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; text-decoration: none; color: inherit; display: block; transition: box-shadow .2s, transform .1s; }
      .kpi-role-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.1); transform: translateY(-2px); }
      .kpi-role-icon { font-size: 2rem; margin-bottom: 8px; }
      .kpi-role-card h3 { font-weight: 600; margin-bottom: 8px; }
      .kpi-role-stats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
      .kpi-badge { font-size: .7rem; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
      .kpi-badge-red { background: #ffebee; color: #c62828; }
      .kpi-badge-amber { background: #fff3e0; color: #e65100; }
      .kpi-badge-green { background: #e8f5e9; color: #2e7d32; }
      .kpi-role-total { font-size: .8rem; color: var(--text-secondary); }
      .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px; }
      .kpi-card { background: var(--card-bg); border-radius: var(--radius); padding: 20px; border-left: 4px solid var(--success); }
      .kpi-card.kpi-red { border-left-color: #c62828; }
      .kpi-card.kpi-amber { border-left-color: #e65100; }
      .kpi-card.kpi-green { border-left-color: #2e7d32; }
      .kpi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .kpi-name { font-weight: 600; font-size: .9rem; }
      .kpi-status-dot { width: 12px; height: 12px; border-radius: 50%; }
      .kpi-dot-red { background: #c62828; }
      .kpi-dot-amber { background: #e65100; }
      .kpi-dot-green { background: #2e7d32; }
      .kpi-dot-unknown { background: #9e9e9e; }
      .kpi-value { font-size: 2rem; font-weight: 700; color: var(--text); margin-bottom: 4px; }
      .kpi-target { font-size: .8rem; color: var(--text-secondary); margin-bottom: 8px; }
      .kpi-bar-container { height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden; }
      .kpi-bar { height: 100%; border-radius: 3px; transition: width .5s ease; }
      .kpi-bar-green { background: #2e7d32; }
      .kpi-bar-amber { background: #e65100; }
      .kpi-bar-red { background: #c62828; }
      .kpi-ask-bar { display: flex; gap: 8px; margin-bottom: 16px; }
      .kpi-ai-response { margin-top: 16px; }
      .kpi-ai-answer { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
      .kpi-ai-answer h3 { margin-bottom: 8px; font-size: 1rem; }
      .kpi-ai-answer pre { font-size: .8rem; overflow-x: auto; white-space: pre-wrap; }
      .tier-badge { font-size: .65rem; padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,.2); color: #fff; text-transform: uppercase; font-weight: 700; letter-spacing: .5px; }
      .header-logo { height: 28px; margin-right: 8px; vertical-align: middle; }
      .locked { opacity: .5; pointer-events: auto; position: relative; }
      .locked::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,.3); border-radius: var(--radius); }
      .lock-badge { display: inline-block; background: var(--accent); color: #fff; font-size: .7rem; padding: 4px 10px; border-radius: 10px; font-weight: 600; margin-top: 8px; }
      code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font-size: .85rem; }
      .nav-svg { width: 22px; height: 22px; margin-bottom: 2px; }
      .nav-item button { background: none; border: none; cursor: pointer; }
      .sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 200; animation: fadeIn .2s; }
      .sidebar-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 300px; max-width: 85vw; background: #fff; z-index: 201; transform: translateX(100%); transition: transform .3s ease; display: flex; flex-direction: column; box-shadow: -4px 0 24px rgba(0,0,0,.15); }
      .sidebar-drawer.open { transform: translateX(0); }
      .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
      .sidebar-title { font-size: 1.1rem; font-weight: 700; color: var(--primary); }
      .sidebar-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); }
      .sidebar-search { padding: 12px 16px; }
      .sidebar-search-input { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; font-size: .9rem; outline: none; }
      .sidebar-search-input:focus { border-color: var(--primary); }
      .sidebar-nav { flex: 1; overflow-y: auto; padding: 0 12px; }
      .sidebar-category { margin-bottom: 4px; border-radius: 8px; overflow: hidden; }
      .sidebar-cat-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; font-weight: 600; font-size: .85rem; color: var(--text); border-radius: 8px; transition: background .2s; }
      .sidebar-cat-header:hover { background: var(--bg); }
      .sidebar-cat-name { flex: 1; }
      .sidebar-cat-count { font-size: .7rem; background: var(--bg); padding: 2px 8px; border-radius: 10px; color: var(--text-secondary); font-weight: 500; }
      .sidebar-chevron { font-size: .7rem; transition: transform .2s; color: var(--text-secondary); }
      .sidebar-category.open .sidebar-chevron { transform: rotate(90deg); }
      .sidebar-cat-items { display: none; padding: 0 0 8px 20px; }
      .sidebar-category.open .sidebar-cat-items { display: block; }
      .sidebar-item { display: block; padding: 8px 12px; font-size: .85rem; color: var(--text-secondary); text-decoration: none; border-radius: 6px; transition: background .2s, color .2s; }
      .sidebar-item:hover { background: var(--bg); color: var(--primary); }
      .sidebar-footer { padding: 12px 16px; border-top: 1px solid var(--border); }
      .sidebar-footer-info { font-size: .75rem; color: var(--text-secondary); text-align: center; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @media (min-width: 768px) {
        .bottom-nav { display: none; }
        .main-content { margin-bottom: 0; margin-left: 260px; }
        .sidebar-drawer { left: 0; right: auto; top: 56px; transform: none; box-shadow: none; border-right: 1px solid var(--border); width: 260px; }
        .sidebar-overlay { display: none; }
        .sidebar-drawer .sidebar-close { display: none; }
      }
      @media (max-width: 600px) { .action-grid, .agent-grid, .graph-tools, .kpi-summary-grid, .kpi-grid { grid-template-columns: 1fr; } .widget-grid { grid-template-columns: repeat(2, 1fr); } }
    `;
  }
}

// ─── WebSocket Reconnect with Exponential Backoff ───────────────────────────
class WebSocketManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseDelay = 1000;
    this.maxDelay = 30000;
    this.listeners = new Map();
    this.messageQueue = [];
    this.heartbeatInterval = null;
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.ws.send(JSON.stringify(msg));
        }
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;
          this.emit('message', data);
          if (data.type) this.emit(data.type, data);
          
          // Handle banking-specific events
          if (data.type === 'transaction') {
            this.emit('transaction', data);
            if (Notification.permission === 'granted') {
              new Notification(data.amount > 0 ? 'Credit Alert' : 'Debit Alert', {
                body: `${data.amount > 0 ? '+' : ''}NGN ${Math.abs(data.amount).toLocaleString()} - ${data.description}`,
                icon: '/icons/icon-192.png'
              });
            }
          }
        } catch (e) { console.warn('[WS] Parse error:', e); }
      };
      
      this.ws.onclose = (event) => {
        console.log(`[WS] Closed: ${event.code} ${event.reason}`);
        this.stopHeartbeat();
        this.emit('disconnected', { code: event.code, reason: event.reason });
        if (event.code !== 1000) this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.emit('error', error);
      };
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      this.emit('max_reconnects');
      return;
    }
    const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), this.maxDelay);
    const jitter = delay * 0.2 * Math.random();
    this.reconnectAttempts++;
    console.log(`[WS] Reconnecting in ${Math.round(delay + jitter)}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay + jitter);
  }

  send(type, payload) {
    const msg = { type, ...payload, timestamp: Date.now() };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(h => { try { h(data); } catch (e) { console.error('[WS] Handler error:', e); } });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) { this.ws.close(1000, 'Client disconnect'); this.ws = null; }
  }
}

// ─── App Shell Pre-caching ──────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Registered:', reg.scope);
      
      // Request push notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted' && reg.pushManager) {
          try {
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: new Uint8Array(65) // Replace with VAPID key
            });
            console.log('[Push] Subscribed:', sub.endpoint);
          } catch (e) { console.warn('[Push] Subscribe failed:', e); }
        }
      }
    } catch (e) { console.error('[SW] Registration failed:', e); }
  });
}

// Boot
const app = new App();
const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
const wsManager = new WebSocketManager(wsUrl);
wsManager.on('transaction', (data) => {
  console.log('[App] Transaction event:', data);
});
wsManager.on('disconnected', () => {
  console.log('[App] WebSocket disconnected, will auto-reconnect');
});
