#!/usr/bin/env python3
"""fix-validate-jwt.py — codemod that replaces fake validate_jwt implementations
with real, fail-closed HS256 JWT verification (stdlib only).

Background
----------
Dozens of template Python services under services/ shipped a validate_jwt()
that only checked the token had three dot-separated parts and then returned
{"sub": "authenticated"} with a comment like:

    # In production: verify JWT signature with JWT_SECRET
    return {"sub": "authenticated"}, None

Callers paired this with "monitoring mode: warn but allow", i.e. requests with
invalid/missing/forged tokens were still processed. That is silent mockware:
auth appears wired but verifies nothing.

What this script does
---------------------
For every Python file under the given root (default: services/):

1. Locate a `def validate_jwt(headers):` body that matches the fake pattern:
   it contains `parts = token.split(".")` and `len(parts) != 3` AND either the
   "verify JWT signature" TODO comment or a `return {"sub": "authenticated"}`
   line — i.e. no real signature verification.
2. Replace the entire function body with the canonical stdlib HS256 verifier
   (same implementation as services/shared/auth/jwt_validation.py, inlined so
   standalone services do not gain a cross-package import).
3. Rewrite the companion comment `# JWT auth check (monitoring mode: warn but
   allow)` (and variants) to `# JWT auth check — real signature verification,
   fail closed`.

The replacement verifier:
  * requires a Bearer header; otherwise (None, "Missing Bearer token")
  * decodes header/payload/signature (base64url)
  * enforces alg == "HS256"
  * verifies HMAC-SHA256 signature with JWT_SECRET from the environment
    (constant-time compare); placeholder secrets starting with "${" are
    rejected as "auth_not_configured"
  * requires the exp claim and rejects expired tokens
  * optionally enforces iss when JWT_ISSUER is set
  * NEVER warns-and-allows: any failure returns (None, reason)

Usage
-----
    python scripts/fix-validate-jwt.py [--root services] [--dry-run] [--verbose]

Exit code is 0 on success. With --dry-run, prints the files it would change
without writing. This script was committed for reproducibility; the 14
highest-risk services were already patched by hand on
fix/silent-mockware-remediation. Run it (then review + commit) to remediate
the remaining services.
"""

import argparse
import os
import re
import sys

CANONICAL_VERIFIER = '''def validate_jwt(headers):
    """Validate Bearer JWT with real HS256 signature verification (stdlib).

    Fails closed: returns (None, reason) whenever the token cannot be
    cryptographically verified, is expired, is missing exp, or JWT_SECRET is
    not configured. Never warn-and-allow.
    Canonical implementation: services/shared/auth/jwt_validation.py.
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    import hmac, hashlib, base64, json as _json, time as _t
    def _b64url_decode(s):
        s += "=" * (-len(s) % 4)
        return base64.urlsafe_b64decode(s.encode())
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or secret.startswith("${"):
        return None, "auth_not_configured"
    try:
        header = _json.loads(_b64url_decode(parts[0]))
        payload = _json.loads(_b64url_decode(parts[1]))
        signature = _b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    if header.get("alg") != "HS256":
        return None, "Unsupported token algorithm"
    expected = hmac.new(secret.encode(), (parts[0] + "." + parts[1]).encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, signature):
        return None, "Invalid token signature"
    exp = payload.get("exp")
    if exp is None:
        return None, "Token missing exp claim"
    try:
        if _t.time() >= float(exp):
            return None, "Token expired"
    except (TypeError, ValueError):
        return None, "Invalid token expiry"
    issuer = os.environ.get("JWT_ISSUER", "")
    if issuer and payload.get("iss") != issuer:
        return None, "Invalid token issuer"
    return payload, None'''

# Matches the whole fake validate_jwt function, from "def validate_jwt" up to
# (but not including) the next top-level (column-0) statement.
FAKE_FUNC_RE = re.compile(
    r"def validate_jwt\(headers\):\n"          # signature
    r"(?P<body>(?:[ \t]+.*\n|\n)+?)"           # indented body (non-greedy)
    r"(?=^\S)",                                # next top-level statement
    re.MULTILINE,
)

FAKE_MARKERS = (
    '# In production: verify JWT signature',
    '"sub": "authenticated"',
    "'sub': 'authenticated'",
)

WARN_ALLOW_COMMENT_RE = re.compile(
    r"# JWT auth check.*warn but allow.*|# .*monitoring mode.*warn.*allow.*",
    re.IGNORECASE,
)

FIXED_COMMENT = "# JWT auth check — real signature verification, fail closed"


def is_fake_body(body: str) -> bool:
    """True if the validate_jwt body is the known no-op/fake implementation."""
    has_split = 'token.split(".")' in body or "token.split('.')" in body
    has_len_check = "len(parts) != 3" in body
    has_marker = any(m in body for m in FAKE_MARKERS)
    # Must not already verify a signature (avoid rewriting real implementations)
    already_real = "hmac.compare_digest" in body or "jwt.decode" in body
    return has_split and has_len_check and has_marker and not already_real


def fix_source(src: str):
    """Return (new_source, changed) applying both rewrites."""
    changed = False

    def _repl(m):
        nonlocal changed
        if is_fake_body(m.group("body")):
            changed = True
            return CANONICAL_VERIFIER + "\n"
        return m.group(0)

    src = FAKE_FUNC_RE.sub(_repl, src)

    new_src, n = WARN_ALLOW_COMMENT_RE.subn(FIXED_COMMENT, src)
    if n:
        changed = True
        src = new_src
    return src, changed


def iter_python_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__", "venv", ".venv")]
        for fn in filenames:
            if fn.endswith(".py"):
                yield os.path.join(dirpath, fn)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Replace fake validate_jwt with real HS256 verification.")
    ap.add_argument("--root", default="services", help="Directory to scan (default: services)")
    ap.add_argument("--dry-run", action="store_true", help="Print files that would change; do not write")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)

    fixed, scanned = [], 0
    for path in iter_python_files(args.root):
        scanned += 1
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()
        if "def validate_jwt" not in src and "warn but allow" not in src:
            continue
        new_src, changed = fix_source(src)
        if not changed:
            continue
        fixed.append(path)
        if args.dry_run:
            print(f"[dry-run] would rewrite: {path}")
        else:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_src)
            print(f"rewrote: {path}")

    print(f"\nscanned {scanned} python files under {args.root}; "
          f"{'would fix' if args.dry_run else 'fixed'} {len(fixed)} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
