import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("Health & Monitoring Endpoints", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("/healthz returns database connected status", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.status).toBe("ok");
    expect(data.database).toBe("connected");
  });

  it("/healthz includes memory metrics", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    const data = await resp.json() as any;
    expect(data.memory).toBeDefined();
    expect(data.memory.rss).toBeGreaterThan(0);
  });

  it("/api/platform/redis/status returns stats", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/redis/status`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.mode).toBeTruthy();
  });

  it("/api/platform/kafka/status returns topics", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/kafka/status`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.topics).toBeTruthy();
  });

  it("/api/platform/sessions/stats returns session info", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/sessions/stats`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data).toBeDefined();
  });
});
