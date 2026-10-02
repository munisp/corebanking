/**
 * Session Manager — session rotation, concurrent session limits, and audit.
 *
 * W12 C3-P1-B2 (c3-1036): session state is redis-backed.
 * Keys (register pattern session:{tenant}:{session_id}; this module has no
 * tenant context, so tenant="platform"):
 *   session:platform:{sessionId}   JSON Session, TTL 1800s SLIDING (re-expired
 *                                  on every validate — preserves the previous
 *                                  30-minute SESSION_TTL_MS in-memory lifetime)
 *   session:user:{userId}          redis SET of sessionIds for the concurrent-
 *                                  session limit / revokeAll, TTL 1800s sliding
 * Sessions now survive restarts and are consistent across replicas; previously
 * a restart silently logged out every user (or resurrected revoked sessions on
 * a stale replica).
 * FAIL MODE: redis down => these functions throw and callers fail closed —
 * session validation is never silently skipped.
 */

import { randomBytes } from "crypto";
import { logger } from "./logger";
import { getRedis, kvGetJson, kvSetJson, kvDel } from "./redisKv";

interface Session {
  id: string;
  userId: string;
  role: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  rotatedFrom: string | null;
}

// CSPRNG-generated session identifier (256 bits of entropy, URL-safe).
function newSessionId(): string {
  return `sess_${randomBytes(32).toString("base64url")}`;
}
const MAX_CONCURRENT_SESSIONS = 3;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000; // 1800s sliding
const ROTATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const sessionKey = (id: string) => `session:platform:${id}`;
const userSessionsKey = (userId: string) => `session:user:${userId}`;

interface StoredSession extends Omit<Session, "createdAt" | "lastActivity" | "expiresAt"> {
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
}

function toStored(s: Session): StoredSession {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    lastActivity: s.lastActivity.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  };
}

function fromStored(s: StoredSession): Session {
  return {
    ...s,
    createdAt: new Date(s.createdAt),
    lastActivity: new Date(s.lastActivity),
    expiresAt: new Date(s.expiresAt),
  };
}

async function putSession(session: Session): Promise<void> {
  await kvSetJson(sessionKey(session.id), toStored(session), SESSION_TTL_SECONDS);
  const r = getRedis();
  await r.sadd(userSessionsKey(session.userId), session.id);
  await r.expire(userSessionsKey(session.userId), SESSION_TTL_SECONDS);
}

async function removeSession(sessionId: string, userId?: string): Promise<boolean> {
  let uid = userId;
  if (!uid) {
    const existing = await kvGetJson<StoredSession>(sessionKey(sessionId));
    uid = existing?.userId;
  }
  const removed = (await getRedis().del(sessionKey(sessionId))) > 0;
  if (uid) await getRedis().srem(userSessionsKey(uid), sessionId);
  return removed;
}

export async function createSession(userId: string, role: string, ip: string, userAgent: string): Promise<Session> {
  // Enforce concurrent session limit
  const userSessions = await listUserSessions(userId);
  if (userSessions.length >= MAX_CONCURRENT_SESSIONS) {
    const oldest = userSessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    await removeSession(oldest.id, userId);
    logger.info(`[Session] Evicted oldest session ${oldest.id} for user ${userId} (limit: ${MAX_CONCURRENT_SESSIONS})`);
  }

  const session: Session = {
    id: newSessionId(),
    userId,
    role,
    ip,
    userAgent,
    createdAt: new Date(),
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    rotatedFrom: null,
  };

  await putSession(session);
  logger.info(`[Session] Created ${session.id} for ${userId} (${role})`);
  return session;
}

export async function rotateSession(sessionId: string): Promise<Session | null> {
  const old = await kvGetJson<StoredSession>(sessionKey(sessionId));
  if (!old) return null;

  await removeSession(sessionId, old.userId);

  const rotated: Session = {
    id: newSessionId(),
    userId: old.userId,
    role: old.role,
    ip: old.ip,
    userAgent: old.userAgent,
    createdAt: new Date(),
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    rotatedFrom: sessionId,
  };

  await putSession(rotated);
  logger.info(`[Session] Rotated ${sessionId} → ${rotated.id}`);
  return rotated;
}

export async function validateSession(sessionId: string): Promise<Session | null> {
  const stored = await kvGetJson<StoredSession>(sessionKey(sessionId));
  if (!stored) return null;
  const session = fromStored(stored);
  if (new Date() > session.expiresAt) {
    await removeSession(sessionId, session.userId);
    return null;
  }

  session.lastActivity = new Date();

  // Auto-rotate if session is older than rotation interval
  const age = Date.now() - session.createdAt.getTime();
  if (age > ROTATION_INTERVAL_MS) {
    return rotateSession(sessionId);
  }

  // Sliding expiry: persist lastActivity and re-apply the TTL.
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await putSession(session);
  return session;
}

export async function revokeSession(sessionId: string): Promise<boolean> {
  return removeSession(sessionId);
}

export async function revokeAllSessions(userId: string): Promise<number> {
  const ids = await getRedis().smembers(userSessionsKey(userId));
  let count = 0;
  for (const id of ids) {
    if (await removeSession(id, userId)) count++;
  }
  await kvDel(userSessionsKey(userId));
  logger.info(`[Session] Revoked ${count} sessions for ${userId}`);
  return count;
}

export async function getSessionStats(): Promise<{
  active: number;
  expired: number;
  total: number;
  uniqueUsers: number;
  maxConcurrent: number;
  sessionTtlMinutes: number;
  rotationIntervalMinutes: number;
}> {
  // Session IDs are unguessable; stats scan the namespaced keyspace.
  const r = getRedis();
  const now = new Date();
  let active = 0;
  let expired = 0;
  const users = new Set<string>();
  let cursor = "0";
  do {
    const [next, keys] = await r.scan(cursor, "MATCH", "session:platform:*", "COUNT", 200);
    cursor = next;
    for (const key of keys) {
      const stored = await kvGetJson<StoredSession>(key);
      if (!stored) continue;
      if (new Date(stored.expiresAt) > now) active++;
      else expired++;
      users.add(stored.userId);
    }
  } while (cursor !== "0");
  return {
    active,
    expired,
    total: active + expired,
    uniqueUsers: users.size,
    maxConcurrent: MAX_CONCURRENT_SESSIONS,
    sessionTtlMinutes: SESSION_TTL_MS / 60000,
    rotationIntervalMinutes: ROTATION_INTERVAL_MS / 60000,
  };
}

export async function listUserSessions(userId: string): Promise<Session[]> {
  const ids = await getRedis().smembers(userSessionsKey(userId));
  const sessions: Session[] = [];
  for (const id of ids) {
    const stored = await kvGetJson<StoredSession>(sessionKey(id));
    if (stored) sessions.push(fromStored(stored));
    else await getRedis().srem(userSessionsKey(userId), id); // prune stale id
  }
  return sessions;
}
