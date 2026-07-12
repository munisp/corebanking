/**
 * Environment variable validation with fail-fast semantics.
 * Validates required and optional env vars on startup and reports missing/invalid values.
 */

import { logger } from "./logger";

interface EnvVarSpec {
  name: string;
  required: boolean;
  default?: string;
  description: string;
  validate?: (value: string) => boolean;
  sensitive?: boolean;
}

const envSpecs: EnvVarSpec[] = [
  // Core
  { name: "NODE_ENV", required: false, default: "development", description: "Runtime environment" },
  { name: "PORT", required: false, default: "3000", description: "Express gateway port" },

  // Database
  { name: "DATABASE_URL", required: false, default: "", description: "PostgreSQL connection string", sensitive: true },
  { name: "DB_HOST", required: false, default: "localhost", description: "Database host" },
  { name: "DB_PORT", required: false, default: "5432", description: "Database port", validate: (v) => !isNaN(Number(v)) },
  { name: "DB_NAME", required: false, default: "ndsep_db", description: "Database name" },
  { name: "DB_USER", required: false, default: "postgres", description: "Database user" },
  { name: "DB_PASSWORD", required: false, default: "", description: "Database password", sensitive: true },
  { name: "DB_POOL_MIN", required: false, default: "2", description: "Minimum DB pool connections", validate: (v) => !isNaN(Number(v)) },
  { name: "DB_POOL_MAX", required: false, default: "20", description: "Maximum DB pool connections", validate: (v) => !isNaN(Number(v)) },

  // Authentication
  { name: "ENABLE_AUTH", required: false, default: "false", description: "Enable JWT authentication" },
  { name: "KEYCLOAK_URL", required: false, default: "http://localhost:8080", description: "Keycloak server URL" },
  { name: "KEYCLOAK_REALM", required: false, default: "54bank", description: "Keycloak realm" },
  { name: "KEYCLOAK_CLIENT_ID", required: false, default: "54bank-platform", description: "Keycloak client ID" },
  { name: "KEYCLOAK_CLIENT_SECRET", required: false, default: "", description: "Keycloak client secret", sensitive: true },
  { name: "JWT_ISSUER", required: false, default: "", description: "JWT issuer URL" },
  { name: "JWT_AUDIENCE", required: false, default: "54bank-platform", description: "JWT audience" },
  { name: "JWKS_URI", required: false, default: "", description: "JWKS endpoint URL" },

  // Microservice URLs
  { name: "SECURITY_GATEWAY_URL", required: false, default: "http://localhost:8105", description: "Security Gateway URL" },
  { name: "RESILIENCE_SERVICE_URL", required: false, default: "http://localhost:8106", description: "Resilience Service URL" },
  { name: "AGRICULTURE_SERVICE_URL", required: false, default: "http://localhost:8090", description: "Agriculture Service URL" },
  { name: "TELLER_SERVICE_URL", required: false, default: "http://localhost:8091", description: "Teller Service URL" },
  { name: "ISLAMIC_BANKING_URL", required: false, default: "http://localhost:8092", description: "Islamic Banking Service URL" },
  { name: "TRADE_FINANCE_URL", required: false, default: "http://localhost:8093", description: "Trade Finance Service URL" },

  // Rate Limiting
  { name: "RATE_LIMIT_READS", required: false, default: "300", description: "Read requests per minute", validate: (v) => !isNaN(Number(v)) },
  { name: "RATE_LIMIT_WRITES", required: false, default: "60", description: "Write requests per minute", validate: (v) => !isNaN(Number(v)) },

  // Redis
  { name: "REDIS_URL", required: false, default: "redis://localhost:6379", description: "Redis connection URL" },

  // Kafka
  { name: "KAFKA_BROKERS", required: false, default: "localhost:9092", description: "Kafka broker addresses (comma-separated)" },

  // Monitoring
  { name: "PROMETHEUS_ENABLED", required: false, default: "true", description: "Enable Prometheus metrics endpoint" },
  { name: "LOG_LEVEL", required: false, default: "info", description: "Log level (debug, info, warn, error)", validate: (v) => ["debug", "info", "warn", "error"].includes(v) },
];

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  resolved: Record<string, string>;
}

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolved: Record<string, string> = {};

  for (const spec of envSpecs) {
    const value = process.env[spec.name];

    if (!value && spec.required) {
      errors.push(`Missing required env var: ${spec.name} — ${spec.description}`);
      continue;
    }

    const effectiveValue = value || spec.default || "";
    resolved[spec.name] = effectiveValue;

    if (!value && spec.default) {
      if (spec.name !== "NODE_ENV" && spec.name !== "PORT") {
        warnings.push(`${spec.name} not set, using default: ${spec.sensitive ? "***" : spec.default}`);
      }
    }

    if (effectiveValue && spec.validate && !spec.validate(effectiveValue)) {
      errors.push(`Invalid value for ${spec.name}: ${spec.sensitive ? "***" : effectiveValue}`);
    }
  }

  const isProduction = (process.env.NODE_ENV ?? "development") === "production";
  if (isProduction) {
    const productionRequired = ["DATABASE_URL", "KEYCLOAK_URL", "KEYCLOAK_CLIENT_SECRET", "REDIS_URL"];
    for (const name of productionRequired) {
      if (!process.env[name]) {
        errors.push(`Production requires ${name} to be set`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, resolved };
}

export function validateAndLog(): Record<string, string> {
  const result = validateEnvironment();

  if (result.warnings.length > 0) {
    logger.warn(`Environment warnings (${result.warnings.length}):`);
    result.warnings.forEach((w) => logger.warn(`  - ${w}`));
  }

  if (!result.valid) {
    logger.error(`Environment validation failed (${result.errors.length} errors):`);
    result.errors.forEach((e) => logger.error(`  - ${e}`));
    if (process.env.NODE_ENV === "production") {
      logger.error("Refusing to start in production with invalid configuration");
      process.exit(1);
    }
  } else {
    logger.info("Environment validation passed");
  }

  return result.resolved;
}

export function getEnvDoc(): string {
  const lines = ["# Environment Variables\n"];
  let lastCategory = "";

  for (const spec of envSpecs) {
    const category = spec.name.split("_")[0];
    if (category !== lastCategory) {
      lines.push(`\n## ${category}`);
      lastCategory = category;
    }
    const req = spec.required ? "**required**" : `default: \`${spec.default ?? ""}\``;
    lines.push(`- \`${spec.name}\` — ${spec.description} (${req})`);
  }

  return lines.join("\n");
}
