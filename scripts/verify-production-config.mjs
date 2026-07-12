import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();

const checks = [
  {
    relativePath: ".env.production.example",
    rules: [
      {
        label: "DATABASE_URL placeholder",
        pattern: /^DATABASE_URL=.*(?:demo|default|change-me|runtime-secret).*$/m,
        severity: "error",
      },
      {
        label: "JWT_SECRET placeholder",
        pattern: /^JWT_SECRET=.*(?:change-me|demo|default).*$/m,
        severity: "error",
      },
      {
        label: "REDIS_URL placeholder",
        pattern: /^REDIS_URL=.*(?:demo|default|change-me|runtime-secret).*$/m,
        severity: "error",
      },
      {
        label: "KAFKA_BROKER placeholder",
        pattern: /^KAFKA_BROKER=.*(?:demo|default|change-me|localhost).*$/m,
        severity: "error",
      },
    ],
  },
];

const errors = [];
const warnings = [];

for (const check of checks) {
  const filePath = path.join(projectRoot, check.relativePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠  ${check.relativePath} not found`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf-8");

  for (const rule of check.rules) {
    const hasMatch = rule.pattern.test(content);
    const shouldMatch = rule.expectMatch === true;
    const matches = hasMatch === shouldMatch;

    if (!matches) {
      const issue = {
        file: check.relativePath,
        rule: rule.label,
        severity: rule.severity,
      };
      if (rule.severity === "error") {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  }
}

if (warnings.length > 0) {
  console.warn("⚠  Warnings:");
  warnings.forEach(w => console.warn(`  - ${w.file}: ${w.rule}`));
}

if (errors.length > 0) {
  console.error("✗ Production readiness errors found:");
  errors.forEach(e => console.error(`  - ${e.file}: ${e.rule}`));
  process.exit(1);
} else {
  console.log("✓ Production configuration verified");
  process.exit(0);
}
