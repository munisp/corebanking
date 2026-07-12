import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();

const checks = [
  {
    relativePath: ".env.production.example",
    rules: [
      {
        label: "TENANT_SECRET placeholder",
        pattern: /^TENANT_SECRET=.*(?:change-me|demo|default).*$/m,
        severity: "error",
      },
      {
        label: "BUILT_IN_FORGE_API_KEY placeholder",
        pattern: /^BUILT_IN_FORGE_API_KEY=.*(?:demo|default|change-me).*$/m,
        severity: "error",
      },
      {
        label: "JWT_SECRET placeholder",
        pattern: /^JWT_SECRET=.*(?:change-me|demo|default).*$/m,
        severity: "error",
      },
      {
        label: "KEYCLOAK_CLIENT_SECRET placeholder",
        pattern: /^KEYCLOAK_CLIENT_SECRET=.*(?:demo|default|change-me|runtime-secret).*$/m,
        severity: "error",
      },
      {
        label: "MOJALOOP_FSP_SECRET placeholder",
        pattern: /^MOJALOOP_FSP_SECRET=.*(?:demo|default|change-me|runtime-secret).*$/m,
        severity: "error",
      },
      {
        label: "DATABASE_URL placeholder password",
        pattern: /^DATABASE_URL=.*(?:demo|default|change-me|runtime-secret).*$/m,
        severity: "error",
      },
      {
        label: "Production example warning banner missing",
        pattern: /Replace every secret-bearing value with environment-specific secrets before any real deployment\./m,
        severity: "error",
        expectMatch: true,
      },
    ],
  },
  {
    relativePath: "docker-compose.yml",
    rules: [
      {
        label: "TENANT_SECRET compose placeholder",
        pattern: /^\s*TENANT_SECRET:\s*.*(?:change-me|runtime-secret|demo|default).*$/m,
        severity: "error",
      },
      {
        label: "JWT_SECRET compose placeholder",
        pattern: /^\s*JWT_SECRET:\s*.*(?:change-me|runtime-secret|demo|default).*$/m,
        severity: "error",
      },
      {
        label: "Compose references local service URL for upstream platform",
        pattern: /^\s*UPSTREAM_PLATFORM_URL:\s*http:\/\/54bank-ui:3000\s*$/m,
        severity: "warn",
      },
    ],
  },
];

const findings = [];

for (const check of checks) {
  const absolutePath = path.join(projectRoot, check.relativePath);
  if (!fs.existsSync(absolutePath)) {
    findings.push({
      file: check.relativePath,
      severity: "error",
      label: "Required file missing",
      detail: `${check.relativePath} was not found.`,
    });
    continue;
  }

  const content = fs.readFileSync(absolutePath, "utf8");

  for (const rule of check.rules) {
    const expectMatch = rule.expectMatch ?? false;
    const matched = rule.pattern.test(content);
    const violated = expectMatch ? !matched : matched;

    if (!violated) continue;

    findings.push({
      file: check.relativePath,
      severity: rule.severity,
      label: rule.label,
      detail: expectMatch
        ? `Expected pattern was not found in ${check.relativePath}.`
        : `Placeholder or risky default matched in ${check.relativePath}.`,
    });
  }
}

const errors = findings.filter((item) => item.severity === "error");
const warnings = findings.filter((item) => item.severity === "warn");

if (findings.length === 0) {
  console.log("Production config verification passed: no placeholder or risky defaults detected in documented deployment surfaces.");
  process.exit(0);
}

console.log("Production config verification findings:");
for (const finding of findings) {
  console.log(`- [${finding.severity.toUpperCase()}] ${finding.file}: ${finding.label} — ${finding.detail}`);
}

if (warnings.length > 0) {
  console.log(`Warnings: ${warnings.length}`);
}

if (errors.length > 0) {
  console.log(`Errors: ${errors.length}`);
  process.exit(1);
}

process.exit(0);
