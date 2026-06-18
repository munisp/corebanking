import os
"""54Bank Savings Products Service — fixed deposits, target savings, group savings, interest computation."""

import json
import math
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timedelta


MIDDLEWARE_CONFIG = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092")},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379")},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200")},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476")},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500")},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003")},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233")},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002")},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000")},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181")},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080")},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000")},
}

PORT = 8141

SAVINGS_PRODUCTS = [
    {"id": "SP-001", "name": "54Save Fixed Deposit", "type": "fixed_deposit", "minAmount": 100000, "minTenorDays": 30, "maxTenorDays": 365, "interestRate": 14.5, "penaltyRate": 25.0, "currency": "NGN", "status": "active"},
    {"id": "SP-002", "name": "54Save Target", "type": "target_savings", "minAmount": 5000, "minTenorDays": 30, "maxTenorDays": 730, "interestRate": 10.0, "penaltyRate": 0, "currency": "NGN", "status": "active"},
    {"id": "SP-003", "name": "54Save Dollar", "type": "fixed_deposit", "minAmount": 100, "minTenorDays": 90, "maxTenorDays": 365, "interestRate": 4.5, "penaltyRate": 30.0, "currency": "USD", "status": "active"},
    {"id": "SP-004", "name": "54Save Junior", "type": "junior_savings", "minAmount": 1000, "minTenorDays": 0, "maxTenorDays": 0, "interestRate": 8.0, "penaltyRate": 0, "currency": "NGN", "status": "active"},
]

ACCOUNTS = [
    {"id": "SA-001", "productId": "SP-001", "customerId": "CUST-001", "customerName": "Fatima Abdullahi", "balance": 5000000.0, "targetAmount": 0, "startDate": "2026-01-15", "maturityDate": "2026-07-15", "interestEarned": 0, "status": "active", "autoRenew": True},
    {"id": "SA-002", "productId": "SP-002", "customerId": "CUST-002", "customerName": "Ibrahim Musa", "balance": 1200000.0, "targetAmount": 5000000.0, "startDate": "2026-01-01", "maturityDate": "2026-12-31", "interestEarned": 0, "status": "active", "autoRenew": False},
    {"id": "SA-003", "productId": "SP-004", "customerId": "CUST-003", "customerName": "Chioma Okafor (Junior)", "balance": 250000.0, "targetAmount": 0, "startDate": "2025-09-01", "maturityDate": None, "interestEarned": 0, "status": "active", "autoRenew": False},
]


def compute_interest(principal: float, annual_rate: float, days: int) -> float:
    """Simple interest: P * R/100 * D/365"""
    return round(principal * (annual_rate / 100) * (days / 365), 2)


def compute_compound_interest(principal: float, annual_rate: float, days: int, compounding: str = "monthly") -> dict:
    """Compound interest with multiple compounding frequencies."""
    periods_per_year = {"daily": 365, "monthly": 12, "quarterly": 4, "semi_annual": 2, "annual": 1}
    n = periods_per_year.get(compounding, 12)
    r = annual_rate / 100
    t = days / 365
    amount = principal * math.pow(1 + r / n, n * t)
    interest = round(amount - principal, 2)
    effective_rate = round((math.pow(1 + r / n, n) - 1) * 100, 4)
    return {"principal": principal, "interest": interest, "maturityAmount": round(amount, 2), "effectiveRate": effective_rate, "compounding": compounding, "days": days}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length > 0 else {}

    def do_GET(self):
        if self.path == "/healthz":
            return self._json(200, {"status": "ok", "service": "savings-products", "port": str(PORT), "middleware": MIDDLEWARE_CONFIG})
        if self.path == "/v1/savings/products":
            return self._json(200, {"items": SAVINGS_PRODUCTS, "total": len(SAVINGS_PRODUCTS)})
        if self.path == "/v1/savings/accounts":
            return self._json(200, {"items": ACCOUNTS, "total": len(ACCOUNTS)})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        body = self._body()

        if self.path == "/v1/savings/calculate-interest":
            principal = body.get("principal", 0)
            rate = body.get("annualRate", 0)
            days = body.get("days", 0)
            if principal <= 0 or rate <= 0 or days <= 0:
                return self._json(400, {"error": "principal, annualRate, and days must be positive"})
            simple = compute_interest(principal, rate, days)
            compound = compute_compound_interest(principal, rate, days, body.get("compounding", "monthly"))
            return self._json(200, {"simpleInterest": simple, "compoundInterest": compound})

        if self.path == "/v1/savings/open-account":
            product_id = body.get("productId")
            product = next((p for p in SAVINGS_PRODUCTS if p["id"] == product_id), None)
            if not product:
                return self._json(404, {"error": "product not found"})
            amount = body.get("initialDeposit", 0)
            if amount < product["minAmount"]:
                return self._json(400, {"error": f"minimum deposit for {product['name']} is {product['minAmount']} {product['currency']}"})
            tenor_days = body.get("tenorDays", product["minTenorDays"])
            if product["minTenorDays"] > 0 and tenor_days < product["minTenorDays"]:
                return self._json(400, {"error": f"minimum tenor is {product['minTenorDays']} days"})
            if product["maxTenorDays"] > 0 and tenor_days > product["maxTenorDays"]:
                return self._json(400, {"error": f"maximum tenor is {product['maxTenorDays']} days"})

            start = datetime.now()
            maturity = start + timedelta(days=tenor_days) if tenor_days > 0 else None
            projected = compute_interest(amount, product["interestRate"], tenor_days) if tenor_days > 0 else 0
            acct = {
                "id": f"SA-{len(ACCOUNTS)+1:03d}",
                "productId": product_id,
                "customerId": body.get("customerId", ""),
                "customerName": body.get("customerName", ""),
                "balance": amount,
                "targetAmount": body.get("targetAmount", 0),
                "startDate": start.strftime("%Y-%m-%d"),
                "maturityDate": maturity.strftime("%Y-%m-%d") if maturity else None,
                "interestEarned": 0,
                "status": "active",
                "autoRenew": body.get("autoRenew", False),
            }
            ACCOUNTS.append(acct)
            return self._json(201, {"account": acct, "projectedInterest": projected, "product": product})

        if self.path == "/v1/savings/early-withdrawal":
            acct_id = body.get("accountId")
            acct = next((a for a in ACCOUNTS if a["id"] == acct_id), None)
            if not acct:
                return self._json(404, {"error": "account not found"})
            product = next((p for p in SAVINGS_PRODUCTS if p["id"] == acct["productId"]), None)
            if acct["status"] != "active":
                return self._json(400, {"error": f"account status is '{acct['status']}', must be 'active'"})
            if product["type"] == "fixed_deposit":
                start = datetime.strptime(acct["startDate"], "%Y-%m-%d")
                days_held = (datetime.now() - start).days
                gross = compute_interest(acct["balance"], product["interestRate"], days_held)
                penalty = round(gross * product["penaltyRate"] / 100, 2)
                net_interest = round(gross - penalty, 2)
                acct["status"] = "liquidated"
                acct["interestEarned"] = net_interest
                return self._json(200, {
                    "account": acct,
                    "daysHeld": days_held,
                    "grossInterest": gross,
                    "penaltyRate": product["penaltyRate"],
                    "penalty": penalty,
                    "netInterest": net_interest,
                    "payout": round(acct["balance"] + net_interest, 2),
                })
            acct["status"] = "closed"
            return self._json(200, {"account": acct, "payout": acct["balance"]})

        self._json(404, {"error": "not found"})


if __name__ == "__main__":
    print(f"Savings Products Service listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
