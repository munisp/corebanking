#!/usr/bin/env python3
"""
fix-go-scaffold.py — de-fabricate the P1 Go scaffold services (services/*/main.go).

The P1 scaffold template (118 services) contains:
  (a) an in-memory map store, and
  (b) fabrication of processing outcomes: either a background goroutine that
      invents `processingResult` records with `rand.Intn` scores, or an inline
      block inside handleProcess that sets Data["processingResult"]="success"
      and Data["score"]=0.85+rand.Intn(...)/100.

This codemod:
  (a) removes any fabricating goroutine (goroutine body referencing
      rand.Intn together with processingResult/score fabrication),
  (b) replaces the handleProcess fabrication with an honest
      501 {"error":"not_implemented"} response,
  (c) drops the now-unused "math/rand" import when nothing else uses rand.

Idempotent: files already fixed (no fabrication patterns) are skipped.
Services with real domain logic beyond the scaffold are preserved — only the
fabrication blocks are touched.

Usage:
  fix-go-scaffold.py [--apply] [PATH ...]
Default scan root: ./services ; default mode: DRY-RUN.
"""
import argparse
import re
import sys
from pathlib import Path

# Fabricating background goroutine: `go func() { ... rand.Intn ... }()`
FAB_GOROUTINE_RE = re.compile(
    r"\n[ \t]*go func\(\) \{(?:[^{}]|\{[^{}]*\})*?rand\.Intn(?:[^{}]|\{[^{}]*\})*?\}\(\)\n",
    re.S,
)

# Inline fabrication inside handleProcess (whole function replaced by stub).
HANDLE_PROCESS_RE = re.compile(
    r"func handleProcess\(w http\.ResponseWriter, r \*http\.Request\) \{.*?\n\}",
    re.S,
)

FAB_MARKERS = ("processingResult", '"score" = 0.85', 'Data["score"] = 0.85', "rand.Intn(14)")

PROCESS_STUB = """func handleProcess(w http.ResponseWriter, r *http.Request) {
	// NOT IMPLEMENTED: the scaffold previously FABRICATED processing results here
	// (processingResult="success" and a random score via math/rand). Real domain
	// processing must be implemented before this endpoint is enabled.
	// Fail fast; never fabricate.
	respondJSON(w, 501, map[string]string{"error": "not_implemented"})
}
"""


def transform(src: str):
    """Return (new_src, changed, notes)."""
    if "not_implemented" in src and not any(m in src for m in FAB_MARKERS):
        return src, False, ["already fixed"]
    out = src
    notes = []

    # (a) remove fabricating goroutines
    out, n = FAB_GOROUTINE_RE.subn("\n", out)
    if n:
        notes.append(f"removed {n} fabricating goroutine(s)")

    # (b) stub handleProcess if it fabricates
    m = HANDLE_PROCESS_RE.search(out)
    if m and any(k in m.group(0) for k in ("processingResult", "rand.Intn")):
        out = HANDLE_PROCESS_RE.sub(PROCESS_STUB, out, count=1)
        notes.append("handleProcess -> 501 not_implemented")
    elif m and "not_implemented" not in m.group(0):
        notes.append("handleProcess has no fabrication markers; left unchanged")

    # (c) drop unused math/rand import
    body = re.sub(r'import\s*\(.*?\)', "", out, count=1, flags=re.S)
    if "rand." not in body:
        new_out, nimp = re.subn(r'\n[ \t]*"math/rand"', "", out, count=1)
        if nimp:
            out = new_out
            notes.append("removed unused math/rand import")

    return out, out != src, notes


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
            files.extend(sorted(root.glob("*/main.go")) if root.name == "services" else sorted(root.rglob("main.go")))

    changed = 0
    for f in files:
        src = f.read_text(encoding="utf-8")
        new, did_change, notes = transform(src)
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
