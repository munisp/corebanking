#!/usr/bin/env python3
"""
54Bank N+1 Query Detector
Runtime middleware that detects N+1 query patterns by tracking SQL queries per request.

Integration:
  from n1_detector import N1Detector
  detector = N1Detector(threshold=5)
  detector.on_query("SELECT * FROM accounts WHERE id = ?")
  # ... in request handler ...
  detector.check_request("/v1/accounts")  # warns if >5 similar queries
"""

import re
import sys
import time
import threading
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SERVICES_DIR = REPO_ROOT / "services"


class N1Detector:
    """Runtime N+1 query detector for Python services."""

    def __init__(self, threshold: int = 5, log_file: str = None):
        self.threshold = threshold
        self.log_file = log_file
        self._lock = threading.Lock()
        self._request_queries = defaultdict(list)
        self._violations = []

    def on_query(self, sql: str, request_id: str = "default"):
        """Call this for every SQL query executed."""
        normalized = self._normalize_sql(sql)
        with self._lock:
            self._request_queries[request_id].append({
                "sql": normalized,
                "raw": sql[:200],
                "time": time.time(),
            })

    def check_request(self, endpoint: str, request_id: str = "default") -> list:
        """Call at the end of each request to check for N+1 patterns."""
        with self._lock:
            queries = self._request_queries.pop(request_id, [])

        if not queries:
            return []

        # Group by normalized SQL pattern
        patterns = defaultdict(list)
        for q in queries:
            patterns[q["sql"]].append(q)

        violations = []
        for pattern, instances in patterns.items():
            if len(instances) >= self.threshold:
                violation = {
                    "endpoint": endpoint,
                    "pattern": pattern,
                    "count": len(instances),
                    "threshold": self.threshold,
                    "sample_query": instances[0]["raw"],
                    "time": time.time(),
                }
                violations.append(violation)
                self._violations.append(violation)

        return violations

    def get_violations(self) -> list:
        return list(self._violations)

    def clear(self):
        with self._lock:
            self._request_queries.clear()
            self._violations.clear()

    @staticmethod
    def _normalize_sql(sql: str) -> str:
        """Normalize SQL to find similar queries (replace values with ?)."""
        sql = re.sub(r"'[^']*'", "?", sql)
        sql = re.sub(r"\b\d+\b", "?", sql)
        sql = re.sub(r"\s+", " ", sql).strip().upper()
        return sql


def static_n1_scan() -> list:
    """Static analysis scan for N+1 patterns across all services."""
    issues = []
    if not SERVICES_DIR.exists():
        return issues

    # Patterns that indicate queries inside loops
    go_patterns = [
        (r'for\s+.*\{[^}]{0,500}db\.Query', "db.Query inside for loop"),
        (r'for\s+.*\{[^}]{0,500}db\.Exec', "db.Exec inside for loop"),
        (r'for\s+.*\{[^}]{0,500}db\.QueryRow', "db.QueryRow inside for loop"),
        (r'rows\.Next\(\)[^}]{0,300}db\.Query', "nested query during row iteration"),
    ]

    py_patterns = [
        (r'for\s+\w+\s+in\s+\w+:[^#]{0,500}cursor\.execute', "cursor.execute inside for loop"),
        (r'for\s+\w+\s+in\s+\w+:[^#]{0,500}\.query\(', "ORM query inside for loop"),
        (r'for\s+\w+\s+in\s+\w+:[^#]{0,500}session\.execute', "session.execute inside for loop"),
    ]

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue

        for f in service_dir.rglob("*.go"):
            content = f.read_text(errors="ignore")
            for pattern, desc in go_patterns:
                for m in re.finditer(pattern, content, re.DOTALL):
                    line = content[:m.start()].count('\n') + 1
                    issues.append({
                        "file": str(f.relative_to(REPO_ROOT)),
                        "line": line,
                        "type": desc,
                        "service": service_dir.name,
                    })

        for f in service_dir.rglob("*.py"):
            content = f.read_text(errors="ignore")
            for pattern, desc in py_patterns:
                for m in re.finditer(pattern, content, re.DOTALL):
                    line = content[:m.start()].count('\n') + 1
                    issues.append({
                        "file": str(f.relative_to(REPO_ROOT)),
                        "line": line,
                        "type": desc,
                        "service": service_dir.name,
                    })

    return issues


if __name__ == "__main__":
    print("=== 54Bank N+1 Query Detector (Static Scan) ===\n")
    issues = static_n1_scan()
    print(f"Found {len(issues)} potential N+1 query patterns:\n")
    for i, issue in enumerate(issues[:30], 1):
        print(f"  {i}. [{issue['service']}] {issue['file']}:{issue['line']}")
        print(f"     {issue['type']}\n")
