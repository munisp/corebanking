/**
 * Environment configuration for 54Bank platform.
 * Default LLM backend: Ollama (local, open-source, no API key required).
 * All fields are configurable via environment variables.
 */
export const ENV = {
  /** Application identifier — used in JWT audience and session payloads */
  appId: process.env.APP_ID ?? process.env.VITE_APP_ID ?? "54bank-platform",

  /** Secret used to sign and verify session JWTs */
  cookieSecret: process.env.JWT_SECRET ?? "",

  /** PostgreSQL connection string */
  databaseUrl: process.env.DATABASE_URL ?? "",

  /** Keycloak / OIDC server base URL (e.g. http://keycloak:8080) */
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? process.env.KEYCLOAK_URL ?? "",

  /** Default admin user identifier */
  adminUserId: process.env.ADMIN_USER_ID ?? process.env.OWNER_OPEN_ID ?? "admin",

  /**
   * Ollama API base URL.
   * Default: http://ollama:11434 (Docker service name) or http://localhost:11434 (local dev).
   * Override with OLLAMA_API_BASE or LLM_API_BASE for custom deployments.
   */
  ollamaApiBase: process.env.OLLAMA_API_BASE ?? process.env.LLM_API_BASE ?? "http://ollama:11434",

  /**
   * Ollama API key — Ollama does not require an API key by default.
   * Set OLLAMA_API_KEY only if your Ollama instance is behind an auth proxy.
   */
  ollamaApiKey: process.env.OLLAMA_API_KEY ?? process.env.LLM_API_KEY ?? "",

  /** Google Maps API key for geo features */
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",

  /** Node environment */
  isProduction: process.env.NODE_ENV === "production",

  // ─── Backward-compat aliases (deprecated — use ollamaApiBase/ollamaApiKey) ──
  /** @deprecated Use ollamaApiBase */
  openaiApiBase: process.env.OLLAMA_API_BASE ?? process.env.LLM_API_BASE ?? "http://ollama:11434",
  /** @deprecated Use ollamaApiKey */
  openaiApiKey: process.env.OLLAMA_API_KEY ?? process.env.LLM_API_KEY ?? "",
  /** @deprecated Use ollamaApiBase */
  forgeApiUrl: process.env.OLLAMA_API_BASE ?? process.env.LLM_API_BASE ?? "http://ollama:11434",
  /** @deprecated Use ollamaApiKey */
  forgeApiKey: process.env.OLLAMA_API_KEY ?? process.env.LLM_API_KEY ?? "",
  /** @deprecated Use adminUserId */
  ownerOpenId: process.env.ADMIN_USER_ID ?? process.env.OWNER_OPEN_ID ?? "admin",
};
