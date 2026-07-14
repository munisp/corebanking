/**
 * Environment configuration for 54Bank platform.
 * All Manus-specific variables have been replaced with standard,
 * portable environment variables compatible with any deployment target.
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

  /** Default admin user identifier (replaces Manus ownerOpenId) */
  adminUserId: process.env.ADMIN_USER_ID ?? process.env.OWNER_OPEN_ID ?? "admin",

  /** Standard OpenAI-compatible API base URL (e.g. https://api.openai.com/v1) */
  openaiApiBase: process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1",

  /** Standard OpenAI API key */
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",

  /** Google Maps API key for geo features */
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",

  /** Node environment */
  isProduction: process.env.NODE_ENV === "production",

  /**
   * @deprecated Use openaiApiBase instead.
   * Kept for backward compatibility — will be removed in v2.
   */
  forgeApiUrl: process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1",

  /**
   * @deprecated Use openaiApiKey instead.
   * Kept for backward compatibility — will be removed in v2.
   */
  forgeApiKey: process.env.OPENAI_API_KEY ?? "",

  /**
   * @deprecated Use adminUserId instead.
   * Kept for backward compatibility — will be removed in v2.
   */
  ownerOpenId: process.env.ADMIN_USER_ID ?? process.env.OWNER_OPEN_ID ?? "admin",
};
