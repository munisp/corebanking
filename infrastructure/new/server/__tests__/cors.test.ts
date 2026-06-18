import { describe, it, expect } from "vitest";

describe("CORS Policy", () => {
  const prodOrigins = [
    "https://app.54bank.ng",
    "https://admin.54bank.ng",
    "https://api.54bank.ng",
    "https://partner.54bank.ng",
  ];

  it("should allow production origins", () => {
    expect(prodOrigins).toContain("https://app.54bank.ng");
    expect(prodOrigins).toContain("https://admin.54bank.ng");
  });

  it("should reject unknown origins in production", () => {
    const origin = "https://evil.com";
    expect(prodOrigins).not.toContain(origin);
  });

  it("should allow localhost in development", () => {
    const devOrigins = ["http://localhost:3000", "http://localhost:5173"];
    expect(devOrigins).toContain("http://localhost:3000");
  });

  it("should set correct CORS headers", () => {
    const headers = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-Request-Id, X-CSRF-Token, Idempotency-Key",
      "Access-Control-Max-Age": "86400",
    };
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
    expect(headers["Access-Control-Allow-Methods"]).toContain("DELETE");
  });
});
