#!/usr/bin/env python3
"""
fix-go-wire-jwt.py — wire jwtMiddleware onto API routes in Go template services.

Background
----------
~151 generated Go services under services/*-go define a jwtMiddleware (real
JWKS/RS256 verifier after fix-go-jwt.py, or a hand-written real one as in
journal-posting-go) but never wrap any route with it: the server chain is
loggingMiddleware(corsMiddleware(mux)) — auth never executes. Every /api/v1/*
route is unauthenticated at the service layer; edge gateway auth is the only
control (and several gateway routes lack the auth plugin).

What this script does
---------------------
For every services/*-go/main.go that defines `func jwtMiddleware(`:
  1. Rewrite API route registrations from
         mux.HandleFunc("/api/...", handlerName)
         mux.HandleFunc("/v1/...", handlerName)
     to
         mux.Handle("/api/...", jwtMiddleware(<realmArg>, http.HandlerFunc(handlerName)))
     Public infrastructure routes (/healthz, /readyz, /livez, /metrics,
     /health) are left unwrapped so k8s probes and Prometheus keep working.
  2. <realmArg> is `jwtRealmURL()` when that helper exists (added by
     fix-go-jwt.py). Otherwise, if jwtMiddleware takes a realm URL parameter
     and no helper exists, a small jwtRealmURL() helper (env
     KEYCLOAK_REALM_URL, default http://keycloak:8080/realms/54bank) is
     appended at end of file.
  3. Files where jwtMiddleware is already wired (a registration line already
     references jwtMiddleware) are skipped as idempotent no-ops.

Only `func main`-containing mains under services/ are scanned. Files whose
route table uses neither pattern are reported as UNWIRED-REVIEW for manual
follow-up. Dry-run by default; pass --apply to write.

Usage: fix-go-wire-jwt.py [--apply] [--root services] [--verbose]
"""
import argparse
import re
import sys
from pathlib import Path

PUBLIC_PREFIXES = ("/healthz", "/readyz", "/livez", "/metrics", "/health")

ROUTE_RE = re.compile(
    r'^(\s*)mux\.HandleFunc\("([^"]+)",\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$'
)

HELPER = '''
// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}
'''


def process(path: Path, apply: bool, verbose: bool):
    src = path.read_text(encoding="utf-8")
    if "func jwtMiddleware(" not in src:
        return ("skip-no-middleware", 0)
    if "func main(" not in src:
        return ("skip-not-main", 0)

    lines = src.splitlines(keepends=True)
    out = []
    wired = 0
    already = False
    for line in lines:
        if "jwtMiddleware(" in line and "func jwtMiddleware(" not in line:
            already = True
        m = ROUTE_RE.match(line.rstrip("\n"))
        if m:
            indent, route, handler = m.groups()
            if any(route.startswith(p) for p in PUBLIC_PREFIXES):
                out.append(line)
                continue
            if route.startswith("/api/") or route.startswith("/v1/"):
                out.append(
                    f'{indent}mux.Handle("{route}", jwtMiddleware(jwtRealmURL(), '
                    f"http.HandlerFunc({handler})))\n"
                )
                wired += 1
                continue
        out.append(line)

    if wired == 0:
        return ("unwired-review" if not already else "already-wired", 0)
    if already:
        # partial wiring exists; safest to leave mixed files for review
        return ("partial-review", 0)

    new_src = "".join(out)
    if "func jwtRealmURL(" not in new_src:
        if '"os"' not in new_src:
            return ("needs-os-import-review", 0)
        new_src = new_src.rstrip("\n") + "\n" + HELPER

    if apply:
        path.write_text(new_src, encoding="utf-8")
    return ("wired", wired)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="services")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)

    stats = {}
    for path in sorted(Path(args.root).glob("*-go/main.go")):
        status, n = process(path, args.apply, args.verbose)
        stats[status] = stats.get(status, 0) + 1
        if args.verbose or status in ("wired", "unwired-review", "partial-review", "needs-os-import-review"):
            print(f"{status}: {path}" + (f" ({n} routes)" if n else ""))

    print("\nSummary:", stats)
    if not args.apply:
        print("DRY-RUN (default): no files written. Pass --apply to rewrite.")


if __name__ == "__main__":
    sys.exit(main())
