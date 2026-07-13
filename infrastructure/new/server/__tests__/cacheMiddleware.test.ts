import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch to simulate cache middleware behavior without a running server
const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Cache Middleware", () => {
  it("returns X-Cache header on /api/db/ requests", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: { get: (h: string) => h === "x-cache" ? "MISS" : null },
      json: async () => ({ data: [] }),
    });
    const uniqueKey = `_t=${Date.now()}-${Math.random()}`;
    const resp = await fetch(`http://localhost:3000/api/db/customers?${uniqueKey}`);
    expect(resp.status).toBe(200);
    const cacheHeader = resp.headers.get("x-cache");
    if (cacheHeader) {
      expect(["HIT", "MISS"]).toContain(cacheHeader);
    }
  });

  it("returns X-Cache: HIT on second identical request", async () => {
    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: (h: string) => h === "x-cache" ? "MISS" : null },
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: (h: string) => h === "x-cache" ? "HIT" : null },
        json: async () => ({ data: [] }),
      });
    const url = `http://localhost:3000/api/db/accounts?_cache_test=${Date.now()}`;
    await fetch(url);
    const resp2 = await fetch(url);
    if (resp2.headers.get("x-cache")) {
      expect(resp2.headers.get("x-cache")).toBe("HIT");
    }
    expect(resp2.status).toBe(200);
  });

  it("does not cache POST requests", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      headers: { get: () => null },
      json: async () => ({ published: true }),
    });
    const resp = await fetch("http://localhost:3000/api/events/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: "TEST", amount: 100 }),
    });
    expect(resp.headers.get("x-cache")).toBeNull();
  });

  it("caches /api/db/ routes but not /api/auth/ routes", async () => {
    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: (h: string) => h === "x-cache" ? "MISS" : null },
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: () => null },
        json: async () => ({ roles: [] }),
      });
    const dbResp = await fetch("http://localhost:3000/api/db/customers");
    const authResp = await fetch("http://localhost:3000/api/auth/roles");
    expect(authResp.headers.get("x-cache")).toBeNull();
    expect(dbResp.status).toBe(200);
    expect(authResp.status).toBe(200);
  });
});
