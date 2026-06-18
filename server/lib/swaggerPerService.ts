// G3: Swagger UI per microservice — auto-generated OpenAPI specs
import type { Express, Request, Response } from "express";

interface ServiceOpenAPI {
  service: string; port: number; language: string;
  openapi: string; info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, { summary: string; tags: string[] }>>;
}

function generateServiceSpec(name: string, port: number, lang: string, endpoints: string[]): ServiceOpenAPI {
  const paths: Record<string, Record<string, { summary: string; tags: string[] }>> = {};
  for (const ep of endpoints) {
    const method = ep.startsWith("POST") ? "post" : "get";
    const path = ep.replace(/^(GET|POST|PUT|DELETE)\s+/, "");
    paths[path] = { [method]: { summary: `${name} - ${path}`, tags: [name] } };
  }
  return {
    service: name, port, language: lang,
    openapi: "3.0.3",
    info: { title: `54Bank ${name} API`, version: "1.0.0", description: `${name} microservice (${lang} on :${port})` },
    paths,
  };
}

const serviceSpecs: ServiceOpenAPI[] = [
  generateServiceSpec("escrow", 8186, "go", ["GET /v1/escrow/list", "GET /v1/escrow/healthz", "GET /v1/escrow/stats", "POST /v1/escrow/create"]),
  generateServiceSpec("qr-payments", 8187, "go", ["GET /v1/qr-payments/list", "GET /v1/qr-payments/healthz", "POST /v1/qr-payments/generate", "GET /v1/qr-payments/stats"]),
  generateServiceSpec("chatbot", 8179, "python", ["GET /v1/chatbot/list", "POST /v1/chatbot/classify", "GET /v1/chatbot/healthz", "POST /v1/chatbot/respond"]),
  generateServiceSpec("insurance", 8194, "python", ["GET /v1/insurance/list", "GET /v1/insurance/healthz", "POST /v1/insurance/claims", "GET /v1/insurance/stats"]),
  generateServiceSpec("interest-rate-engine", 8131, "go", ["GET /v1/interest-rates/list", "GET /v1/interest-rates/healthz", "GET /v1/interest-rates/cbn-mpr"]),
  generateServiceSpec("risk-scoring", 8145, "rust", ["GET /v1/risk-scoring/list", "GET /v1/risk-scoring/healthz", "POST /v1/risk-scoring/assess", "GET /v1/risk-scoring/models"]),
  generateServiceSpec("salary-processing", 8150, "go", ["GET /v1/salary/list", "POST /v1/salary/batch", "GET /v1/salary/healthz", "POST /v1/salary/instructions"]),
  generateServiceSpec("credit-bureau", 8151, "rust", ["GET /v1/credit-bureau/list", "POST /v1/credit-bureau/check", "GET /v1/credit-bureau/healthz", "GET /v1/credit-bureau/score"]),
  generateServiceSpec("customer-360", 8133, "python", ["GET /v1/customer-360/list", "GET /v1/customer-360/healthz", "GET /v1/customer-360/segments", "GET /v1/customer-360/cross-sell"]),
  generateServiceSpec("diaspora-banking", 8135, "python", ["GET /v1/diaspora/list", "GET /v1/diaspora/healthz", "GET /v1/diaspora/corridors", "POST /v1/diaspora/remittance"]),
  generateServiceSpec("cheque-clearing", 8132, "go", ["GET /v1/cheques/list", "GET /v1/cheques/healthz", "POST /v1/cheques/clear", "POST /v1/cheques/return"]),
  generateServiceSpec("nibss-direct-debit", 8134, "go", ["GET /v1/nibss/mandates", "GET /v1/nibss/healthz", "POST /v1/nibss/instruction", "POST /v1/nibss/cancel"]),
  generateServiceSpec("loan-origination", 8137, "go", ["GET /v1/loans/list", "GET /v1/loans/healthz", "POST /v1/loans/apply", "POST /v1/loans/approve", "GET /v1/loans/amortization"]),
  generateServiceSpec("account-statement", 8138, "go", ["GET /v1/statements/list", "GET /v1/statements/healthz", "GET /v1/statements/generate", "GET /v1/statements/balance"]),
  generateServiceSpec("card-management", 8140, "go", ["GET /v1/cards/list", "GET /v1/cards/healthz", "POST /v1/cards/issue", "POST /v1/cards/block", "POST /v1/cards/pin-reset"]),
  generateServiceSpec("savings-products", 8141, "python", ["GET /v1/savings/products", "GET /v1/savings/accounts", "GET /v1/savings/healthz", "POST /v1/savings/calculate-interest", "POST /v1/savings/open-account"]),
  generateServiceSpec("treasury-liquidity", 8142, "rust", ["GET /v1/treasury/fx-positions", "GET /v1/treasury/money-market", "GET /v1/treasury/healthz"]),
  generateServiceSpec("agent-banking", 8143, "go", ["GET /v1/agents/list", "GET /v1/agents/healthz", "GET /v1/agents/stats", "POST /v1/agents/transaction"]),
  generateServiceSpec("sms-email-gateway", 8144, "go", ["GET /v1/notifications/list", "GET /v1/notifications/healthz", "POST /v1/notifications/send", "GET /v1/notifications/templates"]),
  generateServiceSpec("regulatory-reporting", 8146, "python", ["GET /v1/regulatory/reports", "GET /v1/regulatory/healthz", "POST /v1/regulatory/generate", "GET /v1/regulatory/compliance"]),
  generateServiceSpec("atm-management", 8147, "go", ["GET /v1/atm/list", "GET /v1/atm/healthz", "GET /v1/atm/cash-levels", "POST /v1/atm/replenish"]),
  generateServiceSpec("data-export", 8148, "rust", ["GET /v1/export/list", "GET /v1/export/healthz", "POST /v1/export/generate", "GET /v1/export/download"]),
  generateServiceSpec("customer-insights", 8149, "python", ["GET /v1/insights/list", "GET /v1/insights/healthz", "GET /v1/insights/churn", "GET /v1/insights/cross-sell", "GET /v1/insights/clv"]),
  generateServiceSpec("document-management", 8152, "python", ["GET /v1/documents/list", "GET /v1/documents/healthz", "POST /v1/documents/upload", "GET /v1/documents/search"]),
  generateServiceSpec("pos-terminal", 8153, "go", ["GET /v1/pos/terminals", "GET /v1/pos/healthz", "GET /v1/pos/transactions", "GET /v1/pos/stats"]),
  generateServiceSpec("collateral-valuation", 8154, "rust", ["GET /v1/collateral/list", "GET /v1/collateral/healthz", "POST /v1/collateral/valuate", "GET /v1/collateral/fsv"]),
  generateServiceSpec("customer-feedback", 8155, "python", ["GET /v1/feedback/list", "GET /v1/feedback/healthz", "POST /v1/feedback/submit", "GET /v1/feedback/nps"]),
  generateServiceSpec("money-market", 8156, "rust", ["GET /v1/money-market/deals", "GET /v1/money-market/healthz", "POST /v1/money-market/place", "GET /v1/money-market/rates"]),
  generateServiceSpec("securities-trading", 8157, "rust", ["GET /v1/securities/orders", "GET /v1/securities/healthz", "POST /v1/securities/trade", "GET /v1/securities/positions"]),
  generateServiceSpec("supply-chain-finance", 8158, "go", ["GET /v1/scf/invoices", "GET /v1/scf/healthz", "POST /v1/scf/discount", "GET /v1/scf/programs"]),
  generateServiceSpec("open-banking", 8163, "go", ["GET /v1/openbanking/consents", "GET /v1/openbanking/healthz", "POST /v1/openbanking/authorize", "GET /v1/openbanking/accounts"]),
  generateServiceSpec("islamic-banking", 8092, "python", ["GET /v1/islamic/sukuk", "GET /v1/islamic/healthz", "POST /v1/islamic/murabaha", "GET /v1/islamic/takaful"]),
  generateServiceSpec("kyc-aml-screening", 8136, "python", ["GET /v1/kyc/screenings", "GET /v1/kyc/healthz", "POST /v1/kyc/screen", "GET /v1/kyc/sanctions"]),
  generateServiceSpec("bulk-payments", 8139, "rust", ["GET /v1/bulk/batches", "GET /v1/bulk/healthz", "POST /v1/bulk/create", "POST /v1/bulk/process"]),
];

export function registerSwaggerPerService(app: Express) {
  app.get("/api/platform/swagger/services", (_: Request, res: Response) => {
    res.json({ items: serviceSpecs.map(s => ({ service: s.service, port: s.port, language: s.language, endpoint_count: Object.keys(s.paths).length })), total: serviceSpecs.length });
  });

  app.get("/api/platform/swagger/:serviceName", (req: Request, res: Response) => {
    const spec = serviceSpecs.find(s => s.service === req.params.serviceName);
    if (!spec) return res.status(404).json({ error: "Service not found", available: serviceSpecs.map(s => s.service) });
    res.json(spec);
  });
}
