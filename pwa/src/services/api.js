// 54Bank PWA — API client (W12-A4-P0-E: created — app.js imported this module
// but it did not exist, so the entire PWA failed to build).
//
// Same-origin fetch wrapper for every call app.js makes:
//   api.request('GET', '/dashboard/summary')            (app.js:469)
//   api.request('GET', `/dashboard/role/${role}`)       (app.js:481)
//   api.request('POST', '/dashboard/ask', {...})        (app.js:950)
//   api.getTenantFeatures() / api.getTenantBranding()   (app.js:69-70)
//   api.isFeatureAllowed(feature)                       (app.js:101)
//   api.getCoaGraph/getPageRank/getBaselIII/getLiquidity/semanticSearch
//                                                       (app.js:980-986)
//   api.token / api.tenantId / api.setToken / api.setTenantId
//                                                       (app.js:864-1035)
// All requests are relative (same-origin), carry the Bearer token and
// x-tenant-id header, and dispatch the 'auth-required' window event on 401
// (app.js:55 listens for it to route to the login page).

const TOKEN_KEY = '54bank_api_token';
const TENANT_KEY = '54bank_tenant_id';

class ApiService {
  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY) || '';
    this.tenantId = localStorage.getItem(TENANT_KEY) || 'default';
    // Cached tenant feature map for isFeatureAllowed(); refreshed by
    // getTenantFeatures(). Defaults to allow-all so the shell stays usable
    // when the tenant service is unreachable (app.js already tolerates null).
    this._features = null;
  }

  setToken(token) {
    this.token = token || '';
    localStorage.setItem(TOKEN_KEY, this.token);
  }

  setTenantId(tenantId) {
    this.tenantId = tenantId || 'default';
    localStorage.setItem(TENANT_KEY, this.tenantId);
  }

  _headers(extra) {
    const headers = { 'Content-Type': 'application/json', 'x-tenant-id': this.tenantId };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return Object.assign(headers, extra || {});
  }

  async request(method, path, body) {
    const init = { method, headers: this._headers() };
    if (body !== undefined && body !== null) init.body = JSON.stringify(body);
    // path is always a same-origin relative URL (e.g. '/dashboard/summary',
    // '/api/v1/...') — no cross-origin base is ever constructed here.
    const resp = await fetch(path, init);
    if (resp.status === 401) {
      window.dispatchEvent(new CustomEvent('auth-required'));
      throw new Error('Authentication required');
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`API ${method} ${path} failed: ${resp.status} ${text}`.trim());
    }
    const ct = resp.headers.get('content-type') || '';
    return ct.includes('application/json') ? resp.json() : resp.text();
  }

  async getTenantFeatures() {
    const data = await this.request('GET', '/api/v1/tenant/features');
    if (data && data.features) this._features = data.features;
    return data;
  }

  async getTenantBranding() {
    return this.request('GET', '/api/v1/tenant/branding');
  }

  isFeatureAllowed(feature) {
    if (!this._features) return true; // features not loaded yet — do not block UI
    const value = this._features[feature];
    return value === undefined ? true : !!value;
  }

  // ─── Graph / analytics tools (app.js:980-986) ─────────────────────────────
  getCoaGraph() { return this.request('GET', '/api/v1/graph/coa'); }
  getPageRank() { return this.request('GET', '/api/v1/graph/pagerank'); }
  getBaselIII() { return this.request('GET', '/api/v1/graph/basel-iii'); }
  getLiquidity() { return this.request('GET', '/api/v1/graph/liquidity'); }
  semanticSearch(query) { return this.request('POST', '/api/v1/search/semantic', { query }); }
}

export const api = new ApiService();
