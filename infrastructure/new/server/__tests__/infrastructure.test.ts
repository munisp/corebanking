import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");

describe("Infrastructure Files", () => {
  it("should have Dockerfile", () => {
    expect(fs.existsSync(path.join(ROOT, "Dockerfile"))).toBe(true);
  });

  it("should have .dockerignore", () => {
    expect(fs.existsSync(path.join(ROOT, ".dockerignore"))).toBe(true);
  });

  it("should have docker-compose.yml", () => {
    expect(fs.existsSync(path.join(ROOT, "docker-compose.yml"))).toBe(true);
  });

  it("should have CI workflow", () => {
    expect(fs.existsSync(path.join(ROOT, ".github/workflows/ci.yml"))).toBe(true);
  });

  it("should have Helm chart", () => {
    expect(fs.existsSync(path.join(ROOT, "helm/54bank/Chart.yaml"))).toBe(true);
  });

  it("should have README.md with content", () => {
    const readme = path.join(ROOT, "README.md");
    expect(fs.existsSync(readme)).toBe(true);
    const content = fs.readFileSync(readme, "utf-8");
    expect(content.length).toBeGreaterThan(100);
  });

  it("should have LICENSE file", () => {
    expect(fs.existsSync(path.join(ROOT, "LICENSE"))).toBe(true);
  });

  it("should have .env.example", () => {
    expect(fs.existsSync(path.join(ROOT, ".env.example"))).toBe(true);
  });

  it("should have environment configs", () => {
    expect(fs.existsSync(path.join(ROOT, "config/production.env"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "config/staging.env"))).toBe(true);
  });

  it("should have database backup scripts", () => {
    expect(fs.existsSync(path.join(ROOT, "scripts/db-backup.sh"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "scripts/db-restore.sh"))).toBe(true);
  });

  it("should have architecture documentation", () => {
    expect(fs.existsSync(path.join(ROOT, "docs/ARCHITECTURE.md"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "docs/DATA_DICTIONARY.md"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "docs/RUNBOOK.md"))).toBe(true);
  });
});

describe("Service Dockerfiles", () => {
  it("should have service directories", () => {
    const servicesDir = path.join(ROOT, "services");
    expect(fs.existsSync(servicesDir)).toBe(true);
    const services = fs.readdirSync(servicesDir).filter(d => 
      fs.statSync(path.join(servicesDir, d)).isDirectory()
    );
    expect(services.length).toBeGreaterThan(400);
  });
});

describe("Helm Chart Validation", () => {
  it("Chart.yaml should have required fields", () => {
    const chartPath = path.join(ROOT, "helm/54bank/Chart.yaml");
    const content = fs.readFileSync(chartPath, "utf-8");
    expect(content).toContain("apiVersion:");
    expect(content).toContain("name: 54bank");
    expect(content).toContain("version:");
  });

  it("values.yaml should have key configs", () => {
    const valuesPath = path.join(ROOT, "helm/54bank/values.yaml");
    const content = fs.readFileSync(valuesPath, "utf-8");
    expect(content).toContain("replicaCount:");
    expect(content).toContain("postgresql:");
    expect(content).toContain("redis:");
    expect(content).toContain("autoscaling:");
  });
});

describe("Security Configuration", () => {
  it(".env.example should not contain real secrets", () => {
    const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf-8");
    // Should have placeholder values, not real secrets
    expect(envExample).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
    expect(envExample).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);
  });

  it("OWASP security headers should be defined", () => {
    const securityFile = path.join(ROOT, "server/lib/securityHardening.ts");
    const content = fs.readFileSync(securityFile, "utf-8");
    expect(content).toContain("X-Content-Type-Options");
    expect(content).toContain("X-Frame-Options");
    expect(content).toContain("Strict-Transport-Security");
    expect(content).toContain("Content-Security-Policy");
    expect(content).toContain("Referrer-Policy");
    expect(content).toContain("Permissions-Policy");
  });
});
