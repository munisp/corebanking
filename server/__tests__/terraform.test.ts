import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";

describe("Infrastructure as Code", () => {
  it("should have Terraform main.tf", () => {
    expect(existsSync("terraform/main.tf")).toBe(true);
  });

  it("should configure EKS cluster", () => {
    const tf = readFileSync("terraform/main.tf", "utf-8");
    expect(tf).toContain("module \"eks\"");
    expect(tf).toContain("cluster_version");
  });

  it("should configure RDS PostgreSQL", () => {
    const tf = readFileSync("terraform/main.tf", "utf-8");
    expect(tf).toContain("module \"rds\"");
    expect(tf).toContain("engine");
    expect(tf).toContain("postgres");
  });

  it("should configure Redis cache", () => {
    const tf = readFileSync("terraform/main.tf", "utf-8");
    expect(tf).toContain("elasticache");
    expect(tf).toContain("redis");
  });

  it("should have K8s network policies", () => {
    expect(existsSync("k8s/network-policy.yaml")).toBe(true);
  });

  it("should have Helm chart", () => {
    expect(existsSync("helm/54bank/Chart.yaml")).toBe(true);
    expect(existsSync("helm/54bank/values.yaml")).toBe(true);
  });

  it("should have CI/CD pipeline", () => {
    expect(existsSync(".github/workflows/ci.yml")).toBe(true);
  });
});
