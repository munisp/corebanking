import https from "https";

// H-48: Central HTTPS agent factory. TLS verification is ON by default.
// This module is imported by every outbound service client
// (lib/keycloakAdminApiClient.ts, services/*.ts); it must exist for the
// service to compile and run.
//
// Set ALLOW_INSECURE_TLS=true ONLY for local development against self-signed
// endpoints. Any other setting (or unset) keeps certificate verification on.
export function createSecureHttpsAgent(): https.Agent {
  const allowInsecure = process.env.ALLOW_INSECURE_TLS === "true";
  return new https.Agent({
    rejectUnauthorized: !allowInsecure,
    keepAlive: true,
  });
}
