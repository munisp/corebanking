/**
 * Redis Client — connects to Redis when REDIS_URL is set, falls back to in-memory LRU.
 * Uses native Node.js TCP socket to probe Redis (no external dependency).
 */

import net from "net";
import { logger } from "./logger";
import { appCache } from "./cache";

interface RedisState {
  connected: boolean;
  url: string;
  latencyMs: number;
  lastPing: Date | null;
  error: string | null;
  mode: "redis" | "memory";
  stats: { hits: number; misses: number; sets: number; evictions: number };
}

const state: RedisState = {
  connected: false,
  url: process.env.REDIS_URL || "redis://localhost:6379",
  latencyMs: 0,
  lastPing: null,
  error: null,
  mode: "memory",
  stats: { hits: 0, misses: 0, sets: 0, evictions: 0 },
};

let redisSocket: net.Socket | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
const pendingCallbacks = new Map<string, (reply: string) => void>();

function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const u = new URL(url);
    return { host: u.hostname || "localhost", port: parseInt(u.port) || 6379 };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

function sendCommand(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!redisSocket || !state.connected) {
      reject(new Error("Redis not connected"));
      return;
    }
    const id = `${Date.now()}-${Math.random()}`;
    pendingCallbacks.set(id, resolve);
    redisSocket.write(cmd + "\r\n");
    setTimeout(() => {
      pendingCallbacks.delete(id);
      reject(new Error("Redis command timeout"));
    }, 3000);
  });
}

export async function initRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info("[Redis] No REDIS_URL — using in-memory LRU cache");
    state.mode = "memory";
    return;
  }

  const { host, port } = parseRedisUrl(redisUrl);
  logger.info(`[Redis] Connecting to ${host}:${port}...`);

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 5000 });

    socket.on("connect", () => {
      redisSocket = socket;
      state.connected = true;
      state.mode = "redis";
      state.lastPing = new Date();
      state.error = null;
      reconnectAttempts = 0;
      logger.info(`[Redis] Connected to ${host}:${port}`);

      // Start ping interval
      pingInterval = setInterval(async () => {
        try {
          const start = Date.now();
          socket.write("PING\r\n");
          state.latencyMs = Date.now() - start;
          state.lastPing = new Date();
        } catch (err: any) {
          state.error = err.message;
          state.connected = false;
        }
      }, 30000);

      resolve();
    });

    socket.on("data", (data) => {
      const reply = data.toString().trim();
      // Resolve the oldest pending callback
      const firstKey = Array.from(pendingCallbacks.keys())[0];
      if (firstKey) {
        const cb = pendingCallbacks.get(firstKey);
        pendingCallbacks.delete(firstKey);
        cb?.(reply);
      }
    });

    socket.on("error", (err) => {
      state.error = err.message;
      state.connected = false;
      state.mode = "memory";
      logger.warn(`[Redis] Connection failed: ${err.message} — using in-memory cache`);
      resolve();
    });

    socket.on("close", () => {
      state.connected = false;
      state.mode = "memory";
      if (pingInterval) clearInterval(pingInterval);
      logger.info("[Redis] Connection closed — falling back to in-memory cache");
      scheduleReconnect();
    });

    socket.on("timeout", () => {
      state.error = "Connection timeout";
      state.connected = false;
      state.mode = "memory";
      socket.destroy();
      logger.warn("[Redis] Connection timeout — using in-memory cache");
      resolve();
    });
  });
}

// Unified cache interface — uses Redis when available, LRU otherwise
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (state.mode === "redis" && state.connected) {
    try {
      const reply = await sendCommand(`GET ${key}`);
      if (reply && reply !== "$-1" && !reply.startsWith("-")) {
        state.stats.hits++;
        // Parse RESP bulk string
        const lines = reply.split("\r\n");
        const value = lines.length > 1 ? lines[1] : reply.replace(/^\+/, "");
        return JSON.parse(value) as T;
      }
      state.stats.misses++;
      return null;
    } catch {
      state.stats.misses++;
      return appCache.get<T>(key);
    }
  }
  const val = appCache.get<T>(key);
  if (val) state.stats.hits++;
  else state.stats.misses++;
  return val;
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  state.stats.sets++;
  // Always set in local LRU as backup
  appCache.set(key, value, ttlMs);

  if (state.mode === "redis" && state.connected) {
    try {
      const json = JSON.stringify(value);
      const ttlSec = Math.ceil(ttlMs / 1000);
      await sendCommand(`SET ${key} ${json} EX ${ttlSec}`);
    } catch {
      // LRU fallback already set
    }
  }
}

export function getRedisStatus(): RedisState {
  return { ...state };
}

export function shutdownRedis(): void {
  if (pingInterval) clearInterval(pingInterval);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (redisSocket) {
    redisSocket.destroy();
    redisSocket = null;
  }
  state.connected = false;
}

// Auto-reconnect with exponential backoff
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function scheduleReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.warn(`[Redis] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached — staying in memory mode`);
    return;
  }
  const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  reconnectAttempts++;
  logger.info(`[Redis] Reconnecting in ${delayMs}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  reconnectTimer = setTimeout(() => {
    initRedis().catch(() => {});
  }, delayMs);
}
