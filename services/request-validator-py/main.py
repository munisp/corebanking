from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status": "healthy", "service": "request-validator-py", "port": PORT},
            "/api/request-validator/schemas": lambda: {
                "total_schemas": 89, "validated_routes": 805, "unvalidated_routes": 0,
                "schemas": [
                    {"id": "VS-001", "route": "POST /api/accounts", "fields": 12, "rules": 28,
                     "validations": ["required", "type", "min_length", "max_length", "regex", "enum", "custom"],
                     "sample_rules": [
                        {"field": "account_type", "type": "enum", "values": ["savings", "current", "fixed_deposit", "domiciliary"]},
                        {"field": "bvn", "type": "string", "regex": "^[0-9]{11}$", "required": True},
                        {"field": "initial_deposit", "type": "number", "min": 0, "max": 1000000000},
                        {"field": "currency", "type": "enum", "values": ["NGN", "USD", "GBP", "EUR"]},
                     ]},
                    {"id": "VS-002", "route": "POST /api/transfers", "fields": 8, "rules": 22,
                     "validations": ["required", "type", "amount_range", "account_exists", "daily_limit"],
                     "sample_rules": [
                        {"field": "amount", "type": "number", "min": 100, "max": 50000000, "required": True},
                        {"field": "destination_account", "type": "string", "regex": "^[0-9]{10}$"},
                        {"field": "narration", "type": "string", "max_length": 100},
                     ]},
                    {"id": "VS-003", "route": "POST /api/loans", "fields": 15, "rules": 35},
                    {"id": "VS-004", "route": "POST /api/kyc/verify", "fields": 10, "rules": 24},
                    {"id": "VS-005", "route": "POST /api/fx/trade", "fields": 9, "rules": 18},
                ],
                "validation_stats": {
                    "requests_validated_24h": 234000, "rejections_24h": 4560,
                    "rejection_rate": 0.019, "top_rejection_reasons": [
                        {"reason": "missing_required_field", "count": 1890},
                        {"reason": "invalid_type", "count": 1240},
                        {"reason": "value_out_of_range", "count": 780},
                        {"reason": "regex_mismatch", "count": 420},
                        {"reason": "custom_rule_failed", "count": 230},
                    ],
                    "avg_validation_time_ms": 0.8
                }
            },
            "/api/request-validator/middleware": lambda: {
                "kafka": {"topics": ["validation.rejections", "validation.schema.changes"]},
                "dapr": {"stateStore": "validator-state"}, "fluvio": {"topics": ["validation-events"]},
                "temporal": {"workflows": ["schema-sync"]},
                "postgres": {"tables": ["validation_schemas", "validation_rejections"]},
                "keycloak": {"roles": ["validator-admin"]},
                "permify": {"relations": ["validator:can_manage"]},
                "redis": {"keys": ["validator:schema:cache"]},
                "mojaloop": {"oracle": "validator-oracle"},
                "opensearch": {"indices": ["validation-events"]},
                "openappsec": {"policy": "validator-protection"},
                "apisix": {"route": "/api/request-validator/*"},
                "tigerbeetle": {"accounts": []},
                "lakehouse": {"tables": ["validation_analytics"]}
            },
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *a): pass

PORT = int(os.environ.get("PORT", 8315))
print(f"Request Validator on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
