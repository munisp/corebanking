import { describe, it, expect } from "vitest";
import crypto from "crypto";

// H-40 remediation: the previous version generated strings locally and
// asserted their shape — it never touched the MFA implementation, so the
// enroll/verify/backup-code logic could be entirely broken and the suite
// would stay green. These tests register the real production routes from
// lib/mfaTotp on a mock Express app and drive them with mock req/res.
import { registerMfaRoutes } from "../lib/mfaTotp";

type Handler = (req: any, res: any) => any;

function mockApp() {
  const routes: Record<string, Handler> = {};
  return {
    post: (path: string, h: Handler) => { routes[`POST ${path}`] = h; },
    get: (path: string, h: Handler) => { routes[`GET ${path}`] = h; },
    delete: (path: string, h: Handler) => { routes[`DELETE ${path}`] = h; },
    routes,
  };
}

function mockRes() {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  return res;
}

const app = mockApp();
registerMfaRoutes(app as any);

const alice = { id: 1, openId: "user-alice", name: "Alice", email: "alice@54bank.ng", role: "user" };

// RFC 6238 oracle: compute the current TOTP independently of the module
// internals (the module's generateTOTP is not exported).
function currentTotp(base32Secret: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of base32Secret.toUpperCase()) {
    const v = chars.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const keyBytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    keyBytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const counter = Math.floor(Date.now() / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(0, 0);
  msg.writeUInt32BE(counter, 4);
  const hash = crypto.createHmac("sha1", Buffer.from(keyBytes)).update(msg).digest();
  const offset = hash[hash.length - 1]! & 0x0f;
  const code = ((hash[offset]! & 0x7f) << 24 | hash[offset + 1]! << 16 | hash[offset + 2]! << 8 | hash[offset + 3]!) % 1_000_000;
  return code.toString().padStart(6, "0");
}

function enroll(user: any) {
  const res = mockRes();
  app.routes["POST /api/auth/mfa/enroll"]!({ user }, res);
  return res;
}

describe("MFA/TOTP (production lib/mfaTotp)", () => {
  it("enroll rejects unauthenticated requests with 401", () => {
    const res = mockRes();
    app.routes["POST /api/auth/mfa/enroll"]!({}, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("enroll returns a 32-char base32 secret, otpauth URL, and 8 backup codes", () => {
    const res = enroll(alice);
    expect(res.statusCode).toBeUndefined(); // default 200
    expect(res.body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(res.body.otpauthUrl).toContain("otpauth://totp/54Bank:alice@54bank.ng");
    expect(res.body.otpauthUrl).toContain(`secret=${res.body.secret}`);
    expect(res.body.otpauthUrl).toContain("digits=6");
    expect(res.body.otpauthUrl).toContain("period=30");
    expect(res.body.backupCodes).toHaveLength(8);
    for (const code of res.body.backupCodes) {
      expect(code).toMatch(/^[0-9A-F]{8}$/);
    }
  });

  it("verify requires a token (400) and enrollment (400)", () => {
    const res = mockRes();
    app.routes["POST /api/auth/mfa/verify"]!({ user: alice, body: {} }, res);
    expect(res.statusCode).toBe(400);

    const res2 = mockRes();
    app.routes["POST /api/auth/mfa/verify"]!(
      { user: { ...alice, openId: "never-enrolled" }, body: { token: "123456" } },
      res2,
    );
    expect(res2.statusCode).toBe(400);
    expect(res2.body.error).toBe("MFA not enrolled");
  });

  it("verify accepts the current TOTP and enables MFA", () => {
    const enrolled = enroll(alice);
    const token = currentTotp(enrolled.body.secret);

    const res = mockRes();
    app.routes["POST /api/auth/mfa/verify"]!({ user: alice, body: { token } }, res);
    expect(res.statusCode).toBeUndefined();
    expect(res.body.verified).toBe(true);
    expect(res.body.mfaEnabled).toBe(true);

    const status = mockRes();
    app.routes["GET /api/auth/mfa/status"]!({ user: alice }, status);
    expect(status.body.enabled).toBe(true);
    expect(status.body.backupCodesRemaining).toBe(8);
  });

  it("verify rejects a wrong TOTP with 401", () => {
    const enrolled = enroll(alice);
    const good = currentTotp(enrolled.body.secret);
    const bad = good === "000000" ? "000001" : "000000";

    const res = mockRes();
    app.routes["POST /api/auth/mfa/verify"]!({ user: alice, body: { token: bad } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Invalid TOTP token");
  });

  it("validate consumes a backup code exactly once (no replay)", () => {
    const enrolled = enroll(alice);
    // Enable MFA so validate enforces it.
    const token = currentTotp(enrolled.body.secret);
    app.routes["POST /api/auth/mfa/verify"]!({ user: alice, body: { token } }, mockRes());

    const backupCode = enrolled.body.backupCodes[0];
    const first = mockRes();
    app.routes["POST /api/auth/mfa/validate"]!(
      { body: { userId: alice.openId, backupCode } },
      first,
    );
    expect(first.statusCode).toBeUndefined();
    expect(first.body.valid).toBe(true);
    expect(first.body.backupCodesRemaining).toBe(7);

    // Replay of the same backup code must be rejected.
    const replay = mockRes();
    app.routes["POST /api/auth/mfa/validate"]!(
      { body: { userId: alice.openId, backupCode } },
      replay,
    );
    expect(replay.statusCode).toBe(401);
  });

  it("validate is a no-op for users without MFA enabled", () => {
    const res = mockRes();
    app.routes["POST /api/auth/mfa/validate"]!(
      { body: { userId: "no-such-user", token: "000000" } },
      res,
    );
    expect(res.body.valid).toBe(true);
    expect(res.body.mfaRequired).toBe(false);
  });

  it("disable wipes enrollment and status reflects it", () => {
    enroll(alice);
    const res = mockRes();
    app.routes["DELETE /api/auth/mfa/disable"]!({ user: alice }, res);
    expect(res.body.mfaEnabled).toBe(false);

    const status = mockRes();
    app.routes["GET /api/auth/mfa/status"]!({ user: alice }, status);
    expect(status.body.enrolled).toBe(false);
    expect(status.body.enabled).toBe(false);
    expect(status.body.backupCodesRemaining).toBe(0);
  });
});
