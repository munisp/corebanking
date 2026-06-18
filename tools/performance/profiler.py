#!/usr/bin/env python3
"""
54Bank Performance Profiling & Bottleneck Detection
Integrates pprof, pg_stat_statements, Redis slowlog, N+1 detection.

Usage:
  python3 tools/performance/profiler.py [--json] [--postgres-url=...] [--redis-url=...]
"""

import argparse
import json
import os
import re
import socket
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SERVICES_DIR = REPO_ROOT / "services"


# ── 1. PostgreSQL Slow Query Analysis ─────────────────────────────────────────

def analyze_pg_slow_queries(pg_url: str = None) -> dict:
    """Query pg_stat_statements for slow queries."""
    if not pg_url:
        pg_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/corebanking")

    results = {
        "available": False,
        "slow_queries": [],
        "missing_indexes": [],
        "sequential_scans": [],
    }

    try:
        import psycopg2
        conn = psycopg2.connect(pg_url)
        cur = conn.cursor()

        # Top slow queries from pg_stat_statements
        try:
            cur.execute("""
                SELECT query, calls, mean_exec_time, total_exec_time, rows
                FROM pg_stat_statements
                WHERE mean_exec_time > 100
                ORDER BY mean_exec_time DESC
                LIMIT 20
            """)
            results["available"] = True
            for row in cur.fetchall():
                results["slow_queries"].append({
                    "query": row[0][:200],
                    "calls": row[1],
                    "mean_ms": round(row[2], 2),
                    "total_ms": round(row[3], 2),
                    "rows": row[4],
                })
        except Exception:
            pass

        # Tables with high sequential scan ratio
        try:
            cur.execute("""
                SELECT schemaname, relname, seq_scan, idx_scan, seq_tup_read
                FROM pg_stat_user_tables
                WHERE seq_scan > 100 AND (idx_scan = 0 OR seq_scan::float / NULLIF(idx_scan, 0) > 10)
                ORDER BY seq_tup_read DESC
                LIMIT 20
            """)
            for row in cur.fetchall():
                results["sequential_scans"].append({
                    "schema": row[0],
                    "table": row[1],
                    "seq_scans": row[2],
                    "idx_scans": row[3],
                    "seq_rows_read": row[4],
                })
        except Exception:
            pass

        # Missing indexes
        try:
            cur.execute("""
                SELECT schemaname, relname, seq_scan, seq_tup_read,
                       idx_scan, n_live_tup
                FROM pg_stat_user_tables
                WHERE seq_scan > 50 AND n_live_tup > 1000
                  AND (idx_scan IS NULL OR idx_scan = 0)
                ORDER BY seq_tup_read DESC
                LIMIT 20
            """)
            for row in cur.fetchall():
                results["missing_indexes"].append({
                    "table": row[1],
                    "seq_scans": row[2],
                    "rows_read": row[3],
                    "live_rows": row[5],
                })
        except Exception:
            pass

        conn.close()
    except ImportError:
        results["error"] = "psycopg2 not installed"
    except Exception as e:
        results["error"] = str(e)

    return results


# ── 2. Redis Slow Log Analysis ────────────────────────────────────────────────

def analyze_redis_slowlog(redis_host: str = "localhost", redis_port: int = 6379) -> dict:
    """Analyze Redis SLOWLOG for performance issues."""
    results = {
        "available": False,
        "slow_commands": [],
        "memory_stats": {},
        "big_keys": [],
    }

    try:
        sock = socket.create_connection((redis_host, redis_port), timeout=5)
        results["available"] = True

        def redis_cmd(cmd: str) -> str:
            sock.sendall(f"{cmd}\r\n".encode())
            data = b""
            while True:
                chunk = sock.recv(4096)
                data += chunk
                if len(chunk) < 4096:
                    break
            return data.decode(errors="ignore")

        # SLOWLOG GET
        try:
            resp = redis_cmd("SLOWLOG GET 20")
            results["slow_log_raw"] = resp[:500]
        except Exception:
            pass

        # INFO memory
        try:
            resp = redis_cmd("INFO memory")
            for line in resp.split('\r\n'):
                if ':' in line and not line.startswith('#'):
                    k, v = line.split(':', 1)
                    if k in ('used_memory_human', 'used_memory_peak_human', 'mem_fragmentation_ratio', 'maxmemory_human'):
                        results["memory_stats"][k] = v
        except Exception:
            pass

        # INFO stats
        try:
            resp = redis_cmd("INFO stats")
            for line in resp.split('\r\n'):
                if ':' in line and not line.startswith('#'):
                    k, v = line.split(':', 1)
                    if k in ('total_commands_processed', 'keyspace_hits', 'keyspace_misses', 'expired_keys', 'evicted_keys'):
                        results["memory_stats"][k] = v
        except Exception:
            pass

        sock.close()
    except Exception as e:
        results["error"] = str(e)

    return results


# ── 3. N+1 Query Detection ───────────────────────────────────────────────────

def detect_n_plus_one_patterns() -> list[dict]:
    """Static analysis to find N+1 query patterns in service code."""
    issues = []
    if not SERVICES_DIR.exists():
        return issues

    # Pattern: SQL query inside a loop
    loop_query_patterns = [
        # Go: for ... { db.Query/Exec }
        (r'for\s+.*\{[^}]*(?:db\.Query|db\.Exec|db\.QueryRow|rows\.Next)\b', "go"),
        # Python: for ... : cursor.execute
        (r'for\s+.*:\s*\n[^#]*(?:cursor\.execute|db\.execute|session\.query)', "python"),
        # Rust: for ... { sqlx::query }
        (r'for\s+.*\{[^}]*sqlx::query', "rust"),
    ]

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue

        for ext in ("*.go", "*.py", "*.rs"):
            for f in service_dir.rglob(ext):
                try:
                    content = f.read_text(errors="ignore")
                    for pattern, lang in loop_query_patterns:
                        for m in re.finditer(pattern, content, re.DOTALL):
                            line_num = content[:m.start()].count('\n') + 1
                            issues.append({
                                "file": str(f.relative_to(REPO_ROOT)),
                                "line": line_num,
                                "language": lang,
                                "pattern": "query_in_loop",
                                "snippet": m.group(0)[:100],
                            })
                except Exception:
                    continue

    return issues


# ── 4. Go pprof Endpoint Scanner ─────────────────────────────────────────────

def scan_pprof_endpoints() -> dict:
    """Check which services expose pprof endpoints for runtime profiling."""
    results = {"with_pprof": [], "without_pprof": []}
    if not SERVICES_DIR.exists():
        return results

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        has_pprof = False
        for f in service_dir.rglob("*.go"):
            content = f.read_text(errors="ignore")
            if "net/http/pprof" in content or "runtime/pprof" in content:
                has_pprof = True
                break
        if has_pprof:
            results["with_pprof"].append(service_dir.name)
        else:
            results["without_pprof"].append(service_dir.name)

    return results


# ── 5. Connection Pool Analysis ───────────────────────────────────────────────

def analyze_connection_patterns() -> dict:
    """Find services with connection pool issues."""
    results = {"per_request_connections": [], "no_pool": [], "proper_pool": []}
    if not SERVICES_DIR.exists():
        return results

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue

        for f in service_dir.rglob("*"):
            if f.suffix not in (".go", ".py", ".rs") or not f.is_file():
                continue
            content = f.read_text(errors="ignore")

            # Check for per-request connections
            if re.search(r'(?:socket\.create_connection|net\.Dial|TcpStream::connect)', content):
                # Is it inside a handler function?
                if re.search(r'(?:func\s+\w+Handler|def\s+handle_|@app\.route)', content):
                    results["per_request_connections"].append(service_dir.name)
                    break

            # Check for pool usage
            if re.search(r'(?:Pool|pool|ConnectionPool|connection_pool)', content):
                results["proper_pool"].append(service_dir.name)
                break

    return results


# ── 6. Memory Leak Indicators ────────────────────────────────────────────────

def find_memory_leak_indicators() -> list[dict]:
    """Find common memory leak patterns in code."""
    issues = []
    patterns = [
        (r'append\([^)]+\)\s*$', "unbounded_append", "go"),
        (r'\.append\([^)]+\)\s*$', "unbounded_list_grow", "python"),
        (r'go\s+func\s*\(', "goroutine_leak_risk", "go"),
        (r'time\.NewTicker\(', "ticker_without_stop", "go"),
    ]

    if not SERVICES_DIR.exists():
        return issues

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        for ext in ("*.go", "*.py"):
            for f in service_dir.rglob(ext):
                try:
                    content = f.read_text(errors="ignore")
                    for pattern, issue_type, lang in patterns:
                        if f.suffix == ".go" and lang != "go":
                            continue
                        if f.suffix == ".py" and lang != "python":
                            continue
                        matches = re.findall(pattern, content, re.MULTILINE)
                        if len(matches) > 3:
                            issues.append({
                                "file": str(f.relative_to(REPO_ROOT)),
                                "type": issue_type,
                                "count": len(matches),
                            })
                except Exception:
                    continue

    return issues[:30]


# ── Main ──────────────────────────────────────────────────────────────────────

def run_profiling(output_json=False, pg_url=None, redis_host="localhost"):
    results = {}
    print("=== 54Bank Performance Profiler ===\n")

    print("[1/6] Analyzing PostgreSQL slow queries...")
    pg = analyze_pg_slow_queries(pg_url)
    results["postgres"] = pg
    print(f"  Available: {pg['available']}, Slow queries: {len(pg.get('slow_queries', []))}\n")

    print("[2/6] Analyzing Redis performance...")
    redis_data = analyze_redis_slowlog(redis_host)
    results["redis"] = redis_data
    print(f"  Available: {redis_data['available']}\n")

    print("[3/6] Detecting N+1 query patterns...")
    n1 = detect_n_plus_one_patterns()
    results["n_plus_one"] = {"count": len(n1), "items": n1[:20]}
    print(f"  {len(n1)} potential N+1 patterns\n")

    print("[4/6] Scanning pprof endpoints...")
    pprof = scan_pprof_endpoints()
    results["pprof"] = pprof
    print(f"  {len(pprof['with_pprof'])} services with pprof, {len(pprof['without_pprof'])} without\n")

    print("[5/6] Analyzing connection patterns...")
    conn = analyze_connection_patterns()
    results["connections"] = conn
    print(f"  Per-request: {len(conn['per_request_connections'])}, Pooled: {len(conn['proper_pool'])}\n")

    print("[6/6] Finding memory leak indicators...")
    leaks = find_memory_leak_indicators()
    results["memory_leaks"] = {"count": len(leaks), "items": leaks[:20]}
    print(f"  {len(leaks)} potential leak indicators\n")

    print("=" * 60)
    total = len(n1) + len(conn["per_request_connections"]) + len(leaks)
    print(f"TOTAL PERFORMANCE ISSUES: {total}")
    print("=" * 60)

    if output_json:
        print(json.dumps(results, indent=2, default=str))

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="54Bank Performance Profiler")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--postgres-url", default=None)
    parser.add_argument("--redis-host", default="localhost")
    args = parser.parse_args()
    run_profiling(output_json=args.json, pg_url=args.postgres_url, redis_host=args.redis_host)
