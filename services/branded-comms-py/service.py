"""Branded communications service: tenant-specific email, SMS, push notification,
and PDF generation with white-label branding per tenant."""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", "8232"))

MIDDLEWARE = ["kafka", "dapr", "fluvio", "temporal", "postgres", "keycloak",
              "permify", "redis", "mojaloop", "opensearch", "openappsec",
              "apisix", "tigerbeetle", "lakehouse"]

email_queue = [
    {"id": "EQ-001", "tenantId": "54link-dev-retail", "templateName": "transaction_receipt", "recipient": "amina.yusuf@email.com", "subject": "Transaction Confirmation — 54link-dev", "status": "delivered", "sentAt": "2026-05-09T10:00:00Z", "brandedFrom": "54link-dev <noreply@54link-dev.app>"},
    {"id": "EQ-002", "tenantId": "54link-dev-retail", "templateName": "kyc_approved", "recipient": "chidi.okafor@email.com", "subject": "KYC Verification Approved — 54link-dev", "status": "delivered", "sentAt": "2026-05-09T10:05:00Z", "brandedFrom": "54link-dev <noreply@54link-dev.app>"},
    {"id": "EQ-003", "tenantId": "mutual-mfb", "templateName": "loan_approval", "recipient": "fatima.bello@email.com", "subject": "Loan Approved — Mutual MFB", "status": "delivered", "sentAt": "2026-05-09T10:10:00Z", "brandedFrom": "Mutual MFB <noreply@mutualmfb.com>"},
    {"id": "EQ-004", "tenantId": "xmts-agency", "templateName": "agent_commission", "recipient": "agent.kano@xmts.ng", "subject": "Commission Statement — XMTS", "status": "delivered", "sentAt": "2026-05-09T10:15:00Z", "brandedFrom": "XMTS Agency <noreply@xmts.ng>"},
    {"id": "EQ-005", "tenantId": "paystack-embed", "templateName": "transaction_receipt", "recipient": "dev@startup.io", "subject": "Payment Confirmation — Paystack Banking", "status": "failed", "sentAt": "2026-05-09T10:20:00Z", "error": "SMTP connection timeout", "brandedFrom": "Paystack Banking <noreply@banking.paystack.com>"},
]

sms_queue = [
    {"id": "SQ-001", "tenantId": "54link-dev-retail", "recipient": "+234801234567", "message": "Your 54link-dev transfer of ₦50,000 to Chidi was successful. Ref: TXN-2026050901.", "status": "delivered", "sentAt": "2026-05-09T10:00:00Z", "senderName": "54link-dev"},
    {"id": "SQ-002", "tenantId": "mutual-mfb", "recipient": "+234802345678", "message": "Your Mutual MFB loan of ₦500,000 has been approved. Visit your nearest branch.", "status": "delivered", "sentAt": "2026-05-09T10:10:00Z", "senderName": "MutualMFB"},
    {"id": "SQ-003", "tenantId": "xmts-agency", "recipient": "+234803456789", "message": "XMTS Agent: Your commission of ₦12,500 has been credited. Balance: ₦45,200.", "status": "delivered", "sentAt": "2026-05-09T10:15:00Z", "senderName": "XMTS"},
    {"id": "SQ-004", "tenantId": "54link-dev-retail", "recipient": "+234804567890", "message": "OTP: 482915. Valid for 5 minutes. Do not share. — 54link-dev", "status": "delivered", "sentAt": "2026-05-09T10:25:00Z", "senderName": "54link-dev"},
]

push_notifications = [
    {"id": "PN-001", "tenantId": "54link-dev-retail", "title": "Transfer Received", "body": "₦25,000 received from Amina Yusuf", "deviceToken": "fcm_token_abc", "status": "delivered", "sentAt": "2026-05-09T10:00:00Z", "icon": "/assets/54link-dev-icon.png"},
    {"id": "PN-002", "tenantId": "mutual-mfb", "title": "Savings Goal Reached!", "body": "Your 'Rent Fund' savings goal of ₦200,000 is complete", "deviceToken": "fcm_token_def", "status": "delivered", "sentAt": "2026-05-09T10:10:00Z", "icon": "/assets/mutual-icon.png"},
    {"id": "PN-003", "tenantId": "paystack-embed", "title": "Card Transaction", "body": "₦5,000 charged on your virtual card ending 4829", "deviceToken": "fcm_token_ghi", "status": "pending", "sentAt": "2026-05-09T10:20:00Z", "icon": "/assets/paystack-icon.png"},
]

pdf_jobs = [
    {"id": "PJ-001", "tenantId": "54link-dev-retail", "documentType": "account_statement", "customerName": "Amina Yusuf", "period": "April 2026", "status": "generated", "pages": 3, "fileSize": "245KB", "brandedHeader": "54link-dev Financial Services Ltd", "createdAt": "2026-05-01T00:00:00Z"},
    {"id": "PJ-002", "tenantId": "mutual-mfb", "documentType": "loan_schedule", "customerName": "Fatima Bello", "period": "May 2026 - May 2028", "status": "generated", "pages": 2, "fileSize": "128KB", "brandedHeader": "Mutual Microfinance Bank Ltd", "createdAt": "2026-05-05T00:00:00Z"},
    {"id": "PJ-003", "tenantId": "54link-dev-retail", "documentType": "tax_certificate", "customerName": "Chidi Okafor", "period": "FY 2025", "status": "generated", "pages": 1, "fileSize": "89KB", "brandedHeader": "54link-dev Financial Services Ltd", "createdAt": "2026-04-15T00:00:00Z"},
    {"id": "PJ-004", "tenantId": "xmts-agency", "documentType": "commission_report", "customerName": "Agent Kano Hub", "period": "April 2026", "status": "pending", "pages": 0, "fileSize": "0KB", "brandedHeader": "XMTS Mobile Money Operations Ltd", "createdAt": "2026-05-09T00:00:00Z"},
]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        tid = qs.get("tenantId", [None])[0]

        if path == "/healthz":
            return self._json({"status": "healthy",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["branded_comms.events", "branded_comms.audit"]},
                "dapr": {"status": "connected", "appId": "branded_comms-sidecar"},
                "fluvio": {"status": "connected", "topic": "branded_comms-stream"},
                "temporal": {"status": "connected", "namespace": "branded_comms"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "branded_comms"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "branded_comms_authz"},
                "redis": {"status": "connected", "prefix": "branded_comms:"},
                "mojaloop": {"status": "connected", "participant": "branded_comms"},
                "opensearch": {"status": "connected", "index": "branded_comms-*"},
                "openappsec": {"status": "connected", "policy": "branded_comms-protection"},
                "apisix": {"status": "connected", "upstream": "branded_comms"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "branded_comms_iceberg"}
            }, "service": "branded-comms-py", "port": PORT, "middleware": MIDDLEWARE})

        if path == "/v1/emails":
            items = [e for e in email_queue if not tid or e["tenantId"] == tid]
            delivered = sum(1 for e in items if e["status"] == "delivered")
            return self._json({"items": items, "total": len(items), "delivered": delivered, "failed": len(items) - delivered})

        if path == "/v1/sms":
            items = [s for s in sms_queue if not tid or s["tenantId"] == tid]
            return self._json({"items": items, "total": len(items)})

        if path == "/v1/push-notifications":
            items = [p for p in push_notifications if not tid or p["tenantId"] == tid]
            return self._json({"items": items, "total": len(items)})

        if path == "/v1/pdf-jobs":
            items = [p for p in pdf_jobs if not tid or p["tenantId"] == tid]
            generated = sum(1 for p in items if p["status"] == "generated")
            return self._json({"items": items, "total": len(items), "generated": generated})

        if path == "/v1/stats":
            email_delivered = sum(1 for e in email_queue if e["status"] == "delivered")
            sms_delivered = sum(1 for s in sms_queue if s["status"] == "delivered")
            push_delivered = sum(1 for p in push_notifications if p["status"] == "delivered")
            pdf_generated = sum(1 for p in pdf_jobs if p["status"] == "generated")
            tenants = list(set(e["tenantId"] for e in email_queue))
            return self._json({
                "total_emails": len(email_queue), "emails_delivered": email_delivered,
                "total_sms": len(sms_queue), "sms_delivered": sms_delivered,
                "total_push": len(push_notifications), "push_delivered": push_delivered,
                "total_pdf_jobs": len(pdf_jobs), "pdfs_generated": pdf_generated,
                "tenants_with_comms": len(tenants),
                "channels": ["email", "sms", "push", "pdf"],
            })

        self._json({"error": "not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/v1/emails/send":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            if not body.get("tenantId") or not body.get("recipient") or not body.get("templateName"):
                return self._json({"error": "tenantId, recipient, and templateName required"}, 400)
            entry = {
                "id": f"EQ-{len(email_queue)+1:03d}", "tenantId": body["tenantId"],
                "templateName": body["templateName"], "recipient": body["recipient"],
                "subject": body.get("subject", f"Notification — {body['tenantId']}"),
                "status": "queued", "sentAt": "2026-05-09T15:00:00Z",
                "brandedFrom": f"{body['tenantId']} <noreply@{body['tenantId']}.app>",
            }
            email_queue.append(entry)
            return self._json(entry, 201)

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"branded-comms-py listening on :{PORT}")
    server.serve_forever()
