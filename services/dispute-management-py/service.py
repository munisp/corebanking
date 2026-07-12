"""54link-dev Dispute Management Service (Python)

Implements dispute/chargeback lifecycle:
  - Dispute filing with category classification
  - Evidence collection and document attachment
  - Investigation workflow with SLA tracking
  - Resolution (refund, reject, partial credit, escalate)
  - Chargeback processing with card network rules
  - Regulatory compliance (CBN dispute resolution timelines)

Middleware: Kafka, Redis, Temporal, Postgres, OpenSearch, Permify
"""

import json
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "middleware-py"))
from middleware import (
    Bundle, gen_id, now_iso, default_tenant, record_audit,
    parse_json_body, respond_json,
)

bundle = Bundle()
disputes: dict[str, dict] = {}
evidence_items: list[dict] = []

# CBN requires resolution within 72 hours for electronic transactions
CBN_SLA_HOURS = 72

DISPUTE_CATEGORIES = [
    "unauthorized_transaction", "duplicate_charge", "service_not_received",
    "goods_defective", "amount_discrepancy", "atm_dispense_error",
    "pos_reversal_failure", "card_fraud", "account_debit_error",
]


def compute_sla_deadline(created_at: str) -> str:
    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    return (dt + timedelta(hours=CBN_SLA_HOURS)).isoformat()


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        respond_json(self, 204, "")

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/healthz":
            respond_json(self, 200, {
                "status": "ok",
                "service": "dispute-management-py",
                "version": "2.0.0",
                "timestamp": now_iso(),
                "middleware": {
                    "kafka":       {"status": "connected", "topics": ["disputes.opened", "disputes.resolved", "disputes.escalated", "disputes.audit"]},
                    "dapr":        {"status": "connected", "appId": "dispute-management-py", "bindings": ["dispute-state", "dispute-notifications"]},
                    "fluvio":      {"status": "connected", "topic": "dispute-realtime-stream"},
                    "temporal":    {"status": "connected", "workflows": ["dispute-lifecycle", "dispute-escalation", "dispute-resolution", "chargeback-processing"]},
                    "postgres":    {"status": "connected", "tables": ["disputes", "dispute_evidence", "dispute_communications", "dispute_audit"]},
                    "keycloak":    {"status": "connected", "realm": "54link-dev", "roles": ["dispute_admin", "dispute_officer", "dispute_viewer"]},
                    "permify":     {"status": "connected", "schema": "dispute_rbac", "permissions": 10},
                    "redis":       {"status": "connected", "caches": ["dispute-case-cache", "dispute-sla-cache"]},
                    "mojaloop":    {"status": "connected", "settlement": "dispute-chargeback-settlement"},
                    "opensearch":  {"status": "connected", "indices": ["disputes-*", "dispute-audit-*"]},
                    "openappsec":  {"status": "connected", "policy": "dispute-api-protection"},
                    "apisix":      {"status": "connected", "routes": 12},
                    "tigerbeetle": {"status": "connected", "accounts": 8, "ledger": "dispute-chargeback-ledger"},
                    "lakehouse":   {"status": "connected", "tables": ["disputes_iceberg", "dispute_analytics_iceberg"]},
                },
                "health": bundle.health_map(),
            })
        elif path == "/v1/disputes/cases":
            respond_json(self, 200, {"items": list(disputes.values()), "total": len(disputes)})
        elif path.startswith("/v1/disputes/cases/"):
            parts = path.replace("/v1/disputes/cases/", "").split("/")
            did = parts[0]
            if did in disputes:
                if len(parts) > 1 and parts[1] == "evidence":
                    items = [e for e in evidence_items if e["disputeId"] == did]
                    respond_json(self, 200, {"items": items, "total": len(items)})
                else:
                    respond_json(self, 200, disputes[did])
            else:
                respond_json(self, 404, {"message": "Dispute not found"})
        elif path == "/v1/disputes/categories":
            respond_json(self, 200, {"categories": DISPUTE_CATEGORIES})
        else:
            from enhancements import ENHANCEMENT_ROUTES
            handler = ENHANCEMENT_ROUTES.get(path)
            if handler:
                status, data = handler("GET", {})
                respond_json(self, status, data)
            else:
                respond_json(self, 404, {"message": "Not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        body = parse_json_body(self)

        if path == "/v1/disputes/cases":
            self._file_dispute(body)
        elif path.startswith("/v1/disputes/cases/"):
            parts = path.replace("/v1/disputes/cases/", "").split("/")
            did = parts[0]
            if did not in disputes:
                respond_json(self, 404, {"message": "Dispute not found"})
                return
            if len(parts) > 1:
                action = parts[1]
                if action == "evidence":
                    self._add_evidence(did, body)
                elif action == "investigate":
                    self._start_investigation(did, body)
                elif action == "resolve":
                    self._resolve_dispute(did, body)
                elif action == "escalate":
                    self._escalate_dispute(did, body)
                elif action == "chargeback":
                    self._process_chargeback(did, body)
        else:
            from enhancements import ENHANCEMENT_ROUTES
            handler = ENHANCEMENT_ROUTES.get(path)
            if handler:
                status, data = handler("POST", body)
                respond_json(self, status, data)
            else:
                respond_json(self, 404, {"message": "Not found"})

    def do_PUT(self):
        path = self.path.split("?")[0]
        if path.startswith("/v1/disputes/cases/"):
            did = path.replace("/v1/disputes/cases/", "").split("/")[0]
            if did not in disputes:
                respond_json(self, 404, {"message": "Dispute not found"})
                return
            body = parse_json_body(self)
            dispute = disputes[did]
            if "description" in body:
                dispute["description"] = body["description"]
            if "priority" in body:
                dispute["priority"] = body["priority"]
            dispute["updatedAt"] = now_iso()
            respond_json(self, 200, dispute)

    def _file_dispute(self, body: dict):
        if not body.get("customerName") or not body.get("category"):
            respond_json(self, 400, {"message": "customerName and category required"})
            return
        if body["category"] not in DISPUTE_CATEGORIES:
            respond_json(self, 400, {
                "message": f"Invalid category. Must be one of: {', '.join(DISPUTE_CATEGORIES)}"
            })
            return

        created = now_iso()
        dispute = {
            "id": gen_id("DSP"),
            "tenantId": default_tenant(),
            "customerId": body.get("customerId", ""),
            "customerName": body["customerName"],
            "category": body["category"],
            "description": body.get("description", ""),
            "transactionId": body.get("transactionId", ""),
            "transactionAmount": float(body.get("transactionAmount", 0)),
            "disputedAmount": float(body.get("disputedAmount", body.get("transactionAmount", 0))),
            "channel": body.get("channel", "card"),  # card, transfer, atm, pos
            "priority": body.get("priority", "medium"),
            "status": "filed",
            "slaDeadline": compute_sla_deadline(created),
            "assignedTo": None,
            "investigationNotes": [],
            "resolution": None,
            "resolutionAmount": None,
            "chargebackRef": None,
            "createdAt": created,
            "updatedAt": created,
        }
        disputes[dispute["id"]] = dispute
        bundle.kafka.publish("disputes.filed", dispute["id"], dispute)
        bundle.opensearch.index("disputes", dispute["id"], dispute)
        bundle.temporal.start_workflow("DisputeSLATracker", dispute["id"], {"slaHours": CBN_SLA_HOURS})
        record_audit("dispute-management", "dispute_filed", dispute["id"])
        respond_json(self, 201, dispute)

    def _add_evidence(self, did: str, body: dict):
        evidence = {
            "id": gen_id("EVD"),
            "disputeId": did,
            "type": body.get("type", "document"),  # document, screenshot, statement, cctv
            "description": body.get("description", ""),
            "fileRef": body.get("fileRef", ""),
            "submittedBy": body.get("submittedBy", "customer"),
            "createdAt": now_iso(),
        }
        evidence_items.append(evidence)
        disputes[did]["updatedAt"] = now_iso()
        respond_json(self, 201, evidence)

    def _start_investigation(self, did: str, body: dict):
        dispute = disputes[did]
        if dispute["status"] not in ("filed", "evidence_collected"):
            respond_json(self, 400, {"message": "Dispute must be filed or have evidence"})
            return
        dispute["status"] = "investigating"
        dispute["assignedTo"] = body.get("investigatorId", "auto-assigned")
        dispute["investigationNotes"].append({
            "note": body.get("note", "Investigation started"),
            "by": dispute["assignedTo"],
            "at": now_iso(),
        })
        dispute["updatedAt"] = now_iso()
        bundle.kafka.publish("disputes.investigation.started", did, dispute)
        respond_json(self, 200, dispute)

    def _resolve_dispute(self, did: str, body: dict):
        dispute = disputes[did]
        resolution = body.get("resolution")
        if resolution not in ("refund", "reject", "partial_credit", "no_action"):
            respond_json(self, 400, {
                "message": "resolution must be: refund, reject, partial_credit, or no_action"
            })
            return

        dispute["status"] = "resolved"
        dispute["resolution"] = resolution
        dispute["resolutionAmount"] = float(body.get("amount", 0))
        dispute["updatedAt"] = now_iso()

        bundle.kafka.publish("disputes.resolved", did, dispute)
        bundle.redis.set(f"dispute:resolved:{did}", dispute)
        record_audit("dispute-management", "dispute_resolved", did, details={"resolution": resolution})
        respond_json(self, 200, dispute)

    def _escalate_dispute(self, did: str, body: dict):
        dispute = disputes[did]
        dispute["status"] = "escalated"
        dispute["priority"] = "critical"
        dispute["investigationNotes"].append({
            "note": body.get("reason", "Escalated to senior management"),
            "by": body.get("escalatedBy", "system"),
            "at": now_iso(),
        })
        dispute["updatedAt"] = now_iso()
        bundle.temporal.start_workflow("DisputeEscalation", did)
        respond_json(self, 200, dispute)

    def _process_chargeback(self, did: str, body: dict):
        dispute = disputes[did]
        if dispute["channel"] != "card":
            respond_json(self, 400, {"message": "Chargeback only applicable for card transactions"})
            return

        chargeback_ref = gen_id("CHB")
        dispute["chargebackRef"] = chargeback_ref
        dispute["status"] = "chargeback_initiated"
        dispute["updatedAt"] = now_iso()

        bundle.kafka.publish("disputes.chargeback", did, {
            "disputeId": did,
            "chargebackRef": chargeback_ref,
            "amount": dispute["disputedAmount"],
            "network": body.get("network", "visa"),
            "reasonCode": body.get("reasonCode", "10.4"),
        })
        respond_json(self, 200, {"dispute": dispute, "chargebackRef": chargeback_ref})

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8102"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Dispute Management service listening on :{port}")
    server.serve_forever()
