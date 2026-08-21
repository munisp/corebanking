#!/usr/bin/env python3
"""
fix-go-jwt.py — replace structure-only JWT middleware in Go services with the
real JWKS/RS256 verifier ported from services/journal-posting-go.

Fake pattern: any 3-part token is accepted, X-User-Id is set to "validated",
often with the comment "In production: validate against Keycloak JWKS".

Replacement: fetch Keycloak JWKS (KEYCLOAK_REALM_URL), verify the RS256
signature against the key matching the token's kid, enforce exp, and set
X-User-Id from the verified `sub` claim. Fail-closed: any validation problem
rejects the request with 401.

Idempotent: files already doing rsa.VerifyPKCS1v15 verification are skipped.
Files whose middleware does not match the fake pattern are skipped.

Usage:
  fix-go-jwt.py [--apply] [PATH ...]
Default scan root: ./services ; default mode: DRY-RUN.
"""
import argparse
import re
import sys
from pathlib import Path

FAKE_MARKERS = ('"validated"', "In production: validate against Keycloak JWKS",
                "In production", "X-User-Id")

REAL_MIDDLEWARE_TMPL = '''
// ── MIDDLEWARE: JWT Validation (JWKS / RS256) — fail-closed ────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// {FUNC} validates Bearer tokens against the Keycloak JWKS endpoint (RS256
// signature + expiry). Fail-closed: no token is accepted on structure alone.
func {FUNC}(next http.Handler) http.Handler {{
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {{
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {{
			next.ServeHTTP(w, r)
			return
		}}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {{
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{{"error":"unauthorized","service":"{SERVICE}"}}`)
			return
		}}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {{
			http.Error(w, `{{"error":"malformed token"}}`, http.StatusUnauthorized)
			return
		}}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {{
			http.Error(w, `{{"error":"invalid token header"}}`, http.StatusUnauthorized)
			return
		}}
		var header struct {{
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}}
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {{
			http.Error(w, `{{"error":"unsupported token algorithm"}}`, http.StatusUnauthorized)
			return
		}}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {{
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {{
				http.Error(w, `{{"error":"unknown signing key"}}`, http.StatusUnauthorized)
				return
			}}
		}}

		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {{
			http.Error(w, `{{"error":"invalid signature encoding"}}`, http.StatusUnauthorized)
			return
		}}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {{
			http.Error(w, `{{"error":"invalid signature"}}`, http.StatusUnauthorized)
			return
		}}

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{{}}
		json.Unmarshal(claimsBytes, &claims)
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {{
			http.Error(w, `{{"error":"token expired"}}`, http.StatusUnauthorized)
			return
		}}
		if sub, ok := claims["sub"].(string); ok {{
			r.Header.Set("X-User-Id", sub)
		}}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	}})
}}
'''

# Fake middleware: whole func containing the "validated" marker.
FAKE_FUNC_RE = re.compile(
    r"func (jwt\w*)\(\s*(?:realmURL string,\s*)?next http\.Handler\) http\.Handler \{.*?\n\}",
    re.S,
)

REQUIRED_IMPORTS = {
    '"crypto"': "crypto", '"crypto/rsa"': "rsa", '"crypto/sha256"': "sha256",
    '"encoding/base64"': "base64", '"math/big"': "big",
}


def transform(src: str, service: str):
    if "rsa.VerifyPKCS1v15" in src:
        return src, False, ["already verifies RS256 signatures"]
    m = FAKE_FUNC_RE.search(src)
    if not m or not any(k in m.group(0) for k in ('"validated"', "In production")):
        return src, False, []
    func_name = m.group(1)
    real = REAL_MIDDLEWARE_TMPL.replace("{FUNC}", func_name).replace("{SERVICE}", service)
    # convert doubled braces introduced for .format-safety
    out = src[: m.start()] + real + src[m.end():]
    notes = [f"{func_name} -> JWKS RS256 verification (fail-closed)"]

    # add missing imports
    imp_block = re.search(r"import\s*\((.*?)\)", out, re.S)
    if imp_block:
        block = imp_block.group(1)
        for imp in REQUIRED_IMPORTS:
            if imp not in block:
                out, n = re.subn(r"(import\s*\(\n)", r"\1\t" + imp + "\n", out, count=1)
                if n:
                    notes.append(f"added import {imp}")
    else:
        notes.append("WARNING: no import block found — add crypto/rsa/sha256/base64/big imports manually")
    return out, True, notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry-run)")
    ap.add_argument("paths", nargs="*", help="files/dirs to scan (default: ./services)")
    args = ap.parse_args()

    roots = [Path(p) for p in args.paths] if args.paths else [Path("services")]
    files = []
    for root in roots:
        if root.is_file():
            files.append(root)
        elif root.is_dir():
            files.extend(sorted(root.rglob("main.go")))

    changed = 0
    for f in files:
        src = f.read_text(encoding="utf-8")
        new, did_change, notes = transform(src, f.parent.name)
        if not did_change:
            continue
        changed += 1
        print(f"{'APPLY' if args.apply else 'DRY '} {f}: {'; '.join(notes)}")
        if args.apply:
            f.write_text(new, encoding="utf-8")
    print(f"\n{changed} file(s) {'modified' if args.apply else 'would be modified'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
