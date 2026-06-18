/**
 * Session Manager — session rotation, concurrent session limits, and audit.
 */

import { logger } from "./logger";

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

const sessions = new Map<string, Session>();
const MAX_CONCURRENT_SESSIONS = 3;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ROTATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function createSession(userId: string, role: string, ip: string, userAgent: string): Session {
  // Enforce concurrent session limit
  const userSessions = Array.from(sessions.values()).filter(s => s.userId === userId);
  if (userSessions.length >= MAX_CONCURRENT_SESSIONS) {
    const oldest = userSessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    sessions.delete(oldest.id);
    logger.info(`[Session] Evicted oldest session ${oldest.id} for user ${userId} (limit: ${MAX_CONCURRENT_SESSIONS})`);
  }

  const session: Session = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    userId,
    role,
    ip,
    userAgent,
    createdAt: new Date(),
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    rotatedFrom: null,
  };

  sessions.set(session.id, session);
  logger.info(`[Session] Created ${session.id} for ${userId} (${role})`);
  return session;
}

export function rotateSession(sessionId: string): Session | null {
  const old = sessions.get(sessionId);
  if (!old) return null;

  sessions.delete(sessionId);

  const rotated: Session = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    userId: old.userId,
    role: old.role,
    ip: old.ip,
    userAgent: old.userAgent,
    createdAt: new Date(),
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    rotatedFrom: sessionId,
  };

  sessions.set(rotated.id, rotated);
  logger.info(`[Session] Rotated ${sessionId} → ${rotated.id}`);
  return rotated;
}

export function validateSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  session.lastActivity = new Date();

  // Auto-rotate if session is older than rotation interval
  const age = Date.now() - session.createdAt.getTime();
  if (age > ROTATION_INTERVAL_MS) {
    return rotateSession(sessionId);
  }

  return session;
}

export function revokeSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function revokeAllSessions(userId: string): number {
  let count = 0;
  Array.from(sessions.entries()).forEach(([id, session]) => {
    if (session.userId === userId) {
      sessions.delete(id);
      count++;
    }
  });
  logger.info(`[Session] Revoked ${count} sessions for ${userId}`);
  return count;
}

export function getSessionStats() {
  const allSessions = Array.from(sessions.values());
  const now = new Date();
  return {
    active: allSessions.filter(s => s.expiresAt > now).length,
    expired: allSessions.filter(s => s.expiresAt <= now).length,
    total: allSessions.length,
    uniqueUsers: new Set(allSessions.map(s => s.userId)).size,
    maxConcurrent: MAX_CONCURRENT_SESSIONS,
    sessionTtlMinutes: SESSION_TTL_MS / 60000,
    rotationIntervalMinutes: ROTATION_INTERVAL_MS / 60000,
  };
}

export function listUserSessions(userId: string): Session[] {
  return Array.from(sessions.values()).filter(s => s.userId === userId);
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  Array.from(sessions.entries()).forEach(([id, session]) => {
    if (session.expiresAt < now) {
      sessions.delete(id);
      cleaned++;
    }
  });
  if (cleaned > 0) {
    logger.info(`[Session] Cleaned ${cleaned} expired sessions`);
  }
}, 60000);
