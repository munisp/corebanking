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

1. Locate `def validate_jwt(headers):` definitions and extract each function's
   exact line span using indentation-based boundary detection: the function
   ends at the first subsequent non-blank line whose indent is <= the def's
   indent (comments and blank lines never extend the span; trailing blank
   lines are left untouched). Nothing after the function is ever modified.
2. If the body matches the fake pattern (token.split(".") 3-part check plus a
   "verify JWT signature" TODO / `return {"sub": "authenticated"}` marker and
   no real signature verification), replace exactly that span with the
   canonical stdlib HS256 verifier (same implementation as
   services/shared/auth/jwt_validation.py, inlined so standalone services do
   not gain a cross-package import), re-indented to the original def indent.
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

Safety
------
DRY-RUN IS THE DEFAULT: the script only reports the files it would change.
Pass --apply to actually rewrite files.

Syntax gate: the new source is compiled in memory BEFORE anything is written,
and every written file is re-verified with py_compile afterwards. Three cases:

  * new source compiles            -> write + verify (APPLIED)
  * new source fails to compile, but the file ALREADY failed to compile before
    the rewrite with the SAME error (same type/message, same line modulo the
    line-count delta introduced by the replacement, and the error lies outside
    the replaced span) -> the breakage is pre-existing generated-code damage,
    not caused by this codemod: the localized validate_jwt fix is still
    written and the file is reported as PRE-EXISTING-BROKEN (the codemod
    neither fixes nor worsens the unrelated damage).
  * otherwise (the rewrite itself introduced a syntax error) -> the file is
    NOT written (or rolled back if a post-write verification surprises us)
    and reported loudly as ROLLBACK.

Usage
-----
    python scripts/fix-validate-jwt.py [--root services] [--apply] [--verbose]
                                       [--only 'services/foo-py/*.py']

Exit code is 0 on success (rollbacks also exit 0 but are printed loudly).
This script was committed for reproducibility; the 14 highest-risk services
were already patched by hand on fix/silent-mockware-remediation. Run it
(then review + commit) to remediate the remaining services.
"""

import argparse
import fnmatch
import os
import py_compile
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

# Signature line of the fake (or real) validate_jwt. Leading indentation is
# captured so the function span and the replacement can be indented correctly.
DEF_RE = re.compile(r"^(?P<indent>[ \t]*)def validate_jwt\(headers\):\s*(?:#.*)?$")

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


def _indent_of(line: str) -> str:
    return line[: len(line) - len(line.lstrip(" \t"))]


def find_validate_jwt_spans(lines):
    """Return [(start, end, indent)] line spans (0-based, end exclusive) for
    every `def validate_jwt(headers):` in the file.

    Boundary rule: the function ends at the first subsequent non-blank line
    whose indentation is <= the def's own indentation. Blank lines are skipped
    while scanning (and trailing blank lines are excluded from the span so the
    inter-function gap is preserved verbatim); a comment at the def's indent
    level or less terminates the function like any other statement, so
    comments following the function are never absorbed into the replaced
    span. Works when the function body runs to EOF and never touches anything
    after the function.
    """
    spans = []
    i = 0
    while i < len(lines):
        m = DEF_RE.match(lines[i])
        if not m:
            i += 1
            continue
        indent = m.group("indent")
        start = i
        j = i + 1
        while j < len(lines):
            line = lines[j]
            if line.strip() == "":
                j += 1
                continue
            if len(_indent_of(line)) <= len(indent):
                break
            j += 1
        end = j
        while end > start + 1 and lines[end - 1].strip() == "":
            end -= 1  # keep trailing blank lines out of the replaced span
        spans.append((start, end, indent))
        i = j if j > i else i + 1
    return spans


def _reindent(block_lines, indent):
    if not indent:
        return list(block_lines)
    return [indent + l if l.strip() else l for l in block_lines]


def fix_source(src: str):
    """Return (new_source, changed, replaced_spans).

    replaced_spans is a list of (old_start, old_end, new_start, new_end)
    0-based, end-exclusive line ranges for each replaced validate_jwt body,
    used by the syntax gate to map pre-existing error line numbers.
    """
    lines = src.split("\n")
    spans = find_validate_jwt_spans(lines)
    replaced = []

    out = []
    cursor = 0
    for start, end, indent in spans:
        body = "\n".join(lines[start:end])
        if not is_fake_body(body):
            continue
        new_lines = _reindent(CANONICAL_VERIFIER.split("\n"), indent)
        out.extend(lines[cursor:start])
        new_start = len(out)
        out.extend(new_lines)
        replaced.append((start, end, new_start, len(out)))
        cursor = end
    out.extend(lines[cursor:])

    changed = bool(replaced)
    new_src = "\n".join(out)

    new_src2, n = WARN_ALLOW_COMMENT_RE.subn(FIXED_COMMENT, new_src)
    if n:
        changed = True
        new_src = new_src2
    return new_src, changed, replaced


def syntax_error(src: str, path: str = "<src>"):
    """Compile in memory; return (exc_type_name, msg, lineno) or None."""
    try:
        compile(src, path, "exec")
        return None
    except SyntaxError as exc:
        return (type(exc).__name__, exc.msg, exc.lineno)


def is_preexisting_error(err_before, err_after, replaced_spans):
    """True if err_after is the SAME syntax error the file already had before
    the rewrite (same type/message; line number shifted exactly by the line
    delta of replacements that precede it; error not inside a replaced span).
    """
    if err_before is None or err_after is None:
        return False
    if err_before[0] != err_after[0] or err_before[1] != err_after[1]:
        return False
    lb, la = err_before[2], err_after[2]
    if lb is None or la is None:
        return True  # no line info: type+message match is the best we can do
    delta = 0
    for old_start, old_end, new_start, new_end in replaced_spans:
        # 1-based error line vs 0-based exclusive spans
        if lb <= old_start:      # error before this span: unaffected
            continue
        if lb <= old_end:        # error inside the replaced span: not same
            return False
        delta += (new_end - new_start) - (old_end - old_start)
    return la == lb + delta


def iter_python_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in (".git", "node_modules", "__pycache__", "venv", ".venv"))
        for fn in sorted(filenames):
            if fn.endswith(".py"):
                yield os.path.join(dirpath, fn)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Replace fake validate_jwt with real HS256 verification.")
    ap.add_argument("--root", default="services", help="Directory to scan (default: services)")
    ap.add_argument("--apply", action="store_true",
                    help="Actually rewrite files (DEFAULT is dry-run: report only)")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--only", default=None, metavar="GLOB",
                    help="Only process paths matching this fnmatch glob "
                         "(matched against the path as yielded under --root)")
    args = ap.parse_args(argv)

    if not args.apply:
        print("DRY-RUN (default): no files will be written. Pass --apply to rewrite.")

    fixed, preexisting, skipped_real, rolled_back = [], [], [], []
    scanned = 0
    for path in iter_python_files(args.root):
        if args.only and not fnmatch.fnmatch(path, args.only):
            continue
        scanned += 1
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()
        if "def validate_jwt" not in src and "warn but allow" not in src:
            continue
        new_src, changed, spans = fix_source(src)
        if not changed:
            if "def validate_jwt" in src:
                skipped_real.append(path)
                if args.verbose:
                    print(f"[skip] already real/unrecognized validate_jwt: {path}")
            continue

        # Syntax gate: compile the new source in memory BEFORE writing.
        err_before = syntax_error(src, path)
        err_after = syntax_error(new_src, path)
        if err_after is not None:
            if is_preexisting_error(err_before, err_after, spans):
                preexisting.append(path)
                print(f"PRE-EXISTING-BROKEN {path}: file already had `{err_before[0]}: "
                      f"{err_before[1]}` at line {err_before[2]} (outside validate_jwt, "
                      f"untouched); applying localized fix anyway")
            else:
                rolled_back.append(path)
                print(f"REFUSED {path}: rewrite would introduce `{err_after[0]}: "
                      f"{err_after[1]}` at line {err_after[2]}; file NOT modified")
                continue
        else:
            fixed.append(path)

        if not args.apply:
            print(f"[dry-run] would rewrite: {path}")
            continue

        with open(path, "w", encoding="utf-8") as f:
            f.write(new_src)

        # Post-write verification.
        if path in preexisting:
            # The SAME pre-existing error is expected to remain; anything else
            # means the rewrite disturbed unrelated code -> roll back.
            with open(path, "r", encoding="utf-8") as f:
                err_now = syntax_error(f.read(), path)
            if is_preexisting_error(err_before, err_now, spans):
                print(f"rewrote (validate_jwt fixed; unrelated pre-existing syntax "
                      f"error at line {err_now[2]} left as-is): {path}")
                continue
            with open(path, "w", encoding="utf-8") as f:
                f.write(src)  # roll back to the original content
            preexisting.remove(path)
            rolled_back.append(path)
            print(f"ROLLBACK {path}: post-write syntax error differs from the "
                  f"pre-existing one; original restored")
            continue

        try:
            py_compile.compile(path, doraise=True)
        except py_compile.PyCompileError as exc:
            with open(path, "w", encoding="utf-8") as f:
                f.write(src)  # roll back to the original content
            fixed.remove(path)
            rolled_back.append(path)
            print(f"ROLLBACK {path}: post-write py_compile failed ({exc}); original restored")
            continue
        print(f"rewrote+verified: {path}")

    n_applied = len(fixed) + len(preexisting)
    print(f"\nscanned {scanned} python files under {args.root}; "
          f"{'would fix' if not args.apply else 'fixed'} {n_applied} file(s)"
          f" ({len(fixed)} clean, {len(preexisting)} with pre-existing syntax errors)"
          f"; skipped {len(skipped_real)} already-real/unrecognized"
          + (f"; rolled back/refused {len(rolled_back)} file(s)" if rolled_back else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
