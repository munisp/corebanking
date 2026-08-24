#!/usr/bin/env python3
"""
fix-rust-fake-grpc.py — codemod for the systemic fake gRPC OK responder.

Pattern (found in 113 service files): the length-prefixed `start_grpc_server`
accepts ANY payload and always replies:

    let resp = format!(r#"{"status":"ok","service":"{}"}"#, service_name);

This codemod rewrites that responder so that, by default, it returns a gRPC
UNIMPLEMENTED-style error instead of a fabricated OK:

    let resp = if std::env::var("FAKE_GRPC_OK").ok().as_deref() == Some("1") {
        format!(r#"{"status":"ok","service":"{}"}"#, service_name)
    } else {
        format!(r#"{"error":"unimplemented","grpcStatus":12,"service":"{}"}"#, service_name)
    };

Set FAKE_GRPC_OK=1 for local development to keep the legacy OK responder.

Usage:
    python3 scripts/fix-rust-fake-grpc.py [--root DIR]            # dry-run (default)
    python3 scripts/fix-rust-fake-grpc.py --apply [--root DIR]    # rewrite files

Properties:
  - Dry-run by default (prints files that WOULD change).
  - Idempotent: files already containing the FAKE_GRPC_OK guard are skipped.
  - Skips any file that does not contain the exact fake responder pattern.
  - Exit code 0 normally; 1 if --apply encountered a write error.
"""

import argparse
import os
import sys

FAKE_PATTERN = 'let resp = format!(r#"{{"status":"ok","service":"{}"}}"#, service_name);'

REPLACEMENT = (
    "let resp = if std::env::var(\"FAKE_GRPC_OK\").ok().as_deref() == Some(\"1\") {\n"
    "                        // FAKE_GRPC_OK=1: legacy stub for local development only.\n"
    '                        format!(r#"{{"status":"ok","service":"{}"}}"#, service_name)\n'
    "                    } else {\n"
    "                        // gRPC UNIMPLEMENTED (status 12): never fabricate OK for\n"
    "                        // an unimplemented handler.\n"
    '                        format!(r#"{{"error":"unimplemented","grpcStatus":12,"service":"{}"}}"#, service_name)\n'
    "                    };"
)

GUARD_MARKER = "FAKE_GRPC_OK"


def find_candidates(root: str):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("target", ".git", "node_modules")]
        for name in filenames:
            if name.endswith(".rs"):
                yield os.path.join(dirpath, name)


def process_file(path: str, apply: bool):
    """Returns (status, detail). status in {'would_change','changed','skipped','already_fixed','error'}"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except (OSError, UnicodeDecodeError) as e:
        return ("error", str(e))

    if GUARD_MARKER in content:
        return ("already_fixed", None)
    if FAKE_PATTERN not in content:
        return ("skipped", None)

    new_content = content.replace(FAKE_PATTERN, REPLACEMENT)
    if new_content == content:
        return ("skipped", None)

    if not apply:
        return ("would_change", None)

    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
    except OSError as e:
        return ("error", str(e))
    return ("changed", None)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Rewrite fake gRPC OK responders to fail loud (UNIMPLEMENTED) unless FAKE_GRPC_OK=1.")
    parser.add_argument("--apply", action="store_true", help="Apply the rewrite (default: dry-run).")
    parser.add_argument("--root", default=".", help="Repository root to scan (default: cwd).")
    args = parser.parse_args(argv)

    counts = {"would_change": 0, "changed": 0, "skipped": 0, "already_fixed": 0, "error": 0}
    exit_code = 0
    for path in sorted(find_candidates(args.root)):
        status, detail = process_file(path, apply=args.apply)
        counts[status] += 1
        if status in ("would_change", "changed"):
            print(f"{status.upper():>13}: {path}")
        elif status == "error":
            print(f"{'ERROR':>13}: {path}: {detail}", file=sys.stderr)
            exit_code = 1

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(
        f"\n[{mode}] changed={counts['changed']} would_change={counts['would_change']} "
        f"already_fixed={counts['already_fixed']} skipped={counts['skipped']} errors={counts['error']}"
    )
    if not args.apply and counts["would_change"]:
        print("Re-run with --apply to rewrite these files.")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
