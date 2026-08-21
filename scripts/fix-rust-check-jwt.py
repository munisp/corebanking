#!/usr/bin/env python3
"""Codemod: replace the fake `check_jwt` Bearer-prefix acceptance in
services/*-rs/src/main.rs with real JWT verification.

The fake pattern (in ~123 generated services) is:

    fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
        let path = req.path();
        if path == "/healthz" || ... { return Ok(()); }
        match req.headers().get("Authorization") {
            Some(val) => {
                if let Ok(s) = val.to_str() {
                    if s.starts_with("Bearer ") { return Ok(()); }   // <-- accepts ANY token
                }
                Err(...)
            }
            None => ...
        }
    }

This script locates the `check_jwt` function body in each
services/*-rs/src/main.rs and, if the body contains the known fake
Bearer-prefix acceptance, replaces the WHOLE function with a real
HS256 verification via the `jsonwebtoken` crate + `JWT_SECRET` env var,
failing CLOSED (503) when the secret is unset and (401) on invalid tokens.

It also adds `jsonwebtoken = "9.3.0"` to the service's Cargo.toml
[dependencies] when missing.

Usage:
    python3 scripts/fix-rust-check-jwt.py            # dry-run (default): print per-file diffs
    python3 scripts/fix-rust-check-jwt.py --apply    # write changes in place

Properties:
  - dry-run by default; --apply required to modify files
  - prints a unified diff per file that WOULD change
  - skips files whose check_jwt does not match the known fake pattern
  - skips files already fixed (idempotent)
"""

import difflib
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICES_GLOB_DIR = os.path.join(REPO_ROOT, "services")

# Marker of the known fake: any Bearer-prefixed header is accepted.
FAKE_MARKER = re.compile(r's\.starts_with\("Bearer "\)\s*\{\s*return\s+Ok\(\(\)\);?\s*\}')
# Marker of an already-fixed function.
FIXED_MARKER = "jsonwebtoken::decode"

# Real replacement body. Uses fully-qualified paths so no new `use` imports
# are required in the target file (only the jsonwebtoken crate dependency).
REAL_CHECK_JWT = '''fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid auth header"}))),
    };
    // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
    let secret = match std::env::var("JWT_SECRET") {
        Ok(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "jwt_validation_unavailable"}))),
    };
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    match jsonwebtoken::decode::<serde_json::Value>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ) {
        Ok(_) => Ok(()),
        Err(_) => Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid or expired token"}))),
    }
}'''


def find_fn_body(src: str, fn_name: str):
    """Locate `fn <fn_name>(...) ... { <body> }` and return (start, body_open, end)
    indices of the whole function (start = index of 'fn', end = index just past
    the closing brace). Returns None if not found."""
    m = re.search(r'\bfn\s+' + re.escape(fn_name) + r'\s*\(', src)
    if not m:
        return None
    # find opening brace of the body (skip the signature, incl. return type)
    i = src.index('{', m.end())
    depth = 0
    j = i
    while j < len(src):
        c = src[j]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return (m.start(), i, j + 1)
        j += 1
    return None


def fix_main_rs(path: str):
    """Return (new_content or None, status_message)."""
    src = open(path, encoding="utf-8").read()
    loc = find_fn_body(src, "check_jwt")
    if not loc:
        return None, "SKIP (no check_jwt function)"
    start, _brace, end = loc
    fn_text = src[start:end]
    if FIXED_MARKER in fn_text:
        return None, "SKIP (already fixed)"
    if not FAKE_MARKER.search(fn_text):
        return None, "SKIP (check_jwt does not match known fake pattern — manual review needed)"
    # Preserve the exact original signature line (up to the body brace) and
    # swap in the real verification body.
    sig = src[start:_brace].rstrip()
    body = REAL_CHECK_JWT[REAL_CHECK_JWT.index('{') + 1:REAL_CHECK_JWT.rindex('}')]
    new_fn = sig + " {" + body + "}"
    return src[:start] + new_fn + src[end:], "FIXED"


def fix_cargo_toml(main_rs_path: str):
    """Ensure jsonwebtoken dep exists in the sibling Cargo.toml."""
    cargo = os.path.join(os.path.dirname(os.path.dirname(main_rs_path)), "Cargo.toml")
    if not os.path.exists(cargo):
        return None, "SKIP (no Cargo.toml)"
    src = open(cargo, encoding="utf-8").read()
    if "jsonwebtoken" in src:
        return None, "SKIP (jsonwebtoken already present)"
    m = re.search(r'\[dependencies\]\s*\n', src)
    if not m:
        return None, "SKIP (no [dependencies] section — manual review needed)"
    new = src[:m.end()] + 'jsonwebtoken = "9.3.0"\n' + src[m.end():]
    return new, "FIXED (added jsonwebtoken dependency)"


def emit_diff(path, old, new):
    rel = os.path.relpath(path, REPO_ROOT)
    for line in difflib.unified_diff(
        old.splitlines(True), new.splitlines(True),
        fromfile="a/" + rel, tofile="b/" + rel,
    ):
        sys.stdout.write(line)


def main():
    apply = "--apply" in sys.argv
    if not os.path.isdir(SERVICES_GLOB_DIR):
        print("no services/ directory found", file=sys.stderr)
        return 1
    n_fixed = n_skipped = 0
    for svc in sorted(os.listdir(SERVICES_GLOB_DIR)):
        if not svc.endswith("-rs"):
            continue
        main_rs = os.path.join(SERVICES_GLOB_DIR, svc, "src", "main.rs")
        if not os.path.exists(main_rs):
            continue
        new_content, status = fix_main_rs(main_rs)
        if new_content is None:
            n_skipped += 1
            print(f"{svc}: {status}")
            continue
        old = open(main_rs, encoding="utf-8").read()
        n_fixed += 1
        print(f"{svc}: {status}")
        emit_diff(main_rs, old, new_content)
        if apply:
            open(main_rs, "w", encoding="utf-8").write(new_content)
        # Cargo.toml dependency
        cargo_new, cargo_status = fix_cargo_toml(main_rs)
        cargo_path = os.path.join(os.path.dirname(os.path.dirname(main_rs)), "Cargo.toml")
        print(f"{svc}/Cargo.toml: {cargo_status}")
        if cargo_new is not None:
            cargo_old = open(cargo_path, encoding="utf-8").read()
            emit_diff(cargo_path, cargo_old, cargo_new)
            if apply:
                open(cargo_path, "w", encoding="utf-8").write(cargo_new)
    mode = "APPLIED" if apply else "DRY-RUN (use --apply to write)"
    print(f"\n{mode}: {n_fixed} file(s) fixed, {n_skipped} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
