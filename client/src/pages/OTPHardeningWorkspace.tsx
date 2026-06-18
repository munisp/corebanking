import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";
const config: CrudConfig = {
  domainKey: "otp-hardening", title: "OTP Hardening",
  subtitle: "Hardened OTP service: TOTP/HOTP (RFC 6238/4226), SMS/Email/WhatsApp/USSD delivery, rate limiting, brute-force protection.",
  icon: Shield, accentColor: "orange",
  fields: [
    { key: "name", label: "Policy Name", type: "text", required: true },
    { key: "channel", label: "Channel", type: "select", options: ["sms", "email", "whatsapp", "ussd", "push"], required: true },
    { key: "otpLength", label: "OTP Length", type: "select", options: ["4", "6", "8"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "name", label: "Policy", sortable: true },
    { key: "channel", label: "Channel", sortable: true },
    { key: "otpLength", label: "Length" },
    { key: "ttlSeconds", label: "TTL" },
    { key: "maxAttempts", label: "Max Attempts" },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/otp-records",
};
export default function OTPHardeningWorkspace() { return <CrudWorkspace config={config} />; }
