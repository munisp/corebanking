#!/usr/bin/env python3
"""
54Bank Static Analysis Pipeline
Dead code detection, cyclomatic complexity, type coverage, import graph validation.

Usage:
  python3 tools/static-analysis/analyze.py [--json] [--ci] [--threshold=15]
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SERVICES_DIR = REPO_ROOT / "services"
CLIENT_DIR = REPO_ROOT / "client" / "src"
MAX_COMPLEXITY = 15


# ── 1. Cyclomatic Complexity ─────────────────────────────────────────────────

def compute_go_complexity(filepath: Path) -> list[dict]:
    """Estimate cyclomatic complexity for Go functions."""
    results = []
    content = filepath.read_text(errors="ignore")

    # Find function definitions
    func_pattern = re.compile(r'^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(', re.MULTILINE)
    decision_keywords = re.compile(r'\b(if|else if|for|switch|case|select|&&|\|\|)\b')

    functions = list(func_pattern.finditer(content))
    for i, match in enumerate(functions):
        func_name = match.group(1)
        start = match.start()
        end = functions[i + 1].start() if i + 1 < len(functions) else len(content)
        func_body = content[start:end]
        complexity = 1 + len(decision_keywords.findall(func_body))

        if complexity > MAX_COMPLEXITY:
            results.append({
                "file": str(filepath.relative_to(REPO_ROOT)),
                "function": func_name,
                "complexity": complexity,
                "language": "go",
            })

    return results


def compute_python_complexity(filepath: Path) -> list[dict]:
    """Estimate cyclomatic complexity for Python functions."""
    results = []
    content = filepath.read_text(errors="ignore")

    func_pattern = re.compile(r'^(?:    )?def\s+(\w+)\s*\(', re.MULTILINE)
    decision_keywords = re.compile(r'\b(if|elif|for|while|except|and|or)\b')

    functions = list(func_pattern.finditer(content))
    for i, match in enumerate(functions):
        func_name = match.group(1)
        start = match.start()
        end = functions[i + 1].start() if i + 1 < len(functions) else len(content)
        func_body = content[start:end]
        complexity = 1 + len(decision_keywords.findall(func_body))

        if complexity > MAX_COMPLEXITY:
            results.append({
                "file": str(filepath.relative_to(REPO_ROOT)),
                "function": func_name,
                "complexity": complexity,
                "language": "python",
            })

    return results


def scan_complexity() -> list[dict]:
    """Scan all services for high-complexity functions."""
    results = []
    if not SERVICES_DIR.exists():
        return results

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        for f in service_dir.rglob("*.go"):
            results.extend(compute_go_complexity(f))
        for f in service_dir.rglob("*.py"):
            results.extend(compute_python_complexity(f))

    return sorted(results, key=lambda x: x["complexity"], reverse=True)


# ── 2. Dead Exports ──────────────────────────────────────────────────────────

def find_dead_exports() -> list[dict]:
    """Find exported Go functions/types that are never imported elsewhere."""
    exports = defaultdict(set)
    imports = set()

    if not SERVICES_DIR.exists():
        return []

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        for f in service_dir.rglob("*.go"):
            content = f.read_text(errors="ignore")
            # Exported = uppercase first letter
            for m in re.finditer(r'^func\s+(?:\([^)]+\)\s+)?([A-Z]\w+)\s*\(', content, re.MULTILINE):
                exports[service_dir.name].add(m.group(1))
            for m in re.finditer(r'^type\s+([A-Z]\w+)\s+', content, re.MULTILINE):
                exports[service_dir.name].add(m.group(1))

    # Check cross-references
    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        for f in service_dir.rglob("*.go"):
            content = f.read_text(errors="ignore")
            for name in set(re.findall(r'\b([A-Z]\w+)\b', content)):
                imports.add(name)

    dead = []
    for svc, names in exports.items():
        for name in names:
            if name not in imports:
                dead.append({"service": svc, "export": name})

    return dead[:50]


# ── 3. Circular Dependency Detection ─────────────────────────────────────────

def find_circular_deps() -> list[list[str]]:
    """Detect circular import dependencies between services."""
    graph = defaultdict(set)

    if not SERVICES_DIR.exists():
        return []

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        svc_name = service_dir.name
        for f in service_dir.rglob("*"):
            if f.suffix in (".go", ".py", ".rs") and f.is_file():
                content = f.read_text(errors="ignore")
                for m in re.finditer(r'(?:http://|https://)?(\w[\w-]+)(?::\d+)?/v1/', content):
                    target = m.group(1)
                    if target != svc_name and target != "localhost":
                        graph[svc_name].add(target)

    # DFS to find cycles
    cycles = []
    visited = set()

    def dfs(node, path):
        if node in path:
            cycle_start = path.index(node)
            cycle = path[cycle_start:] + [node]
            if sorted(cycle) not in [sorted(c) for c in cycles]:
                cycles.append(cycle)
            return
        if node in visited:
            return
        visited.add(node)
        path.append(node)
        for neighbor in graph.get(node, []):
            dfs(neighbor, path[:])

    for node in graph:
        dfs(node, [])

    return cycles[:20]


# ── 4. Unused Dependencies ───────────────────────────────────────────────────

def find_unused_go_imports() -> list[dict]:
    """Find Go files with potentially unused imports."""
    results = []
    if not SERVICES_DIR.exists():
        return results

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        for f in service_dir.rglob("*.go"):
            content = f.read_text(errors="ignore")
            # Find import block
            import_match = re.search(r'import\s+\((.*?)\)', content, re.DOTALL)
            if not import_match:
                continue
            import_block = import_match.group(1)
            for line in import_block.strip().split('\n'):
                line = line.strip()
                if not line or line.startswith('//'):
                    continue
                # Extract package name
                parts = line.strip('"').split('/')
                pkg_name = parts[-1].strip('"').strip()
                if pkg_name and pkg_name != "_":
                    # Check if package is used in the rest of the file
                    rest = content[import_match.end():]
                    if f'\n\t{pkg_name}.' not in rest and f' {pkg_name}.' not in rest and f'({pkg_name}.' not in rest:
                        if pkg_name not in ('fmt', 'os', 'log', 'net', 'http', 'time', 'sync', 'context', 'strings', 'strconv', 'encoding', 'json', 'io', 'math', 'crypto', 'errors'):
                            results.append({
                                "file": str(f.relative_to(REPO_ROOT)),
                                "package": pkg_name,
                            })

    return results[:50]


# ── 5. TODO/FIXME/HACK Scanner ───────────────────────────────────────────────

def find_tech_debt_markers() -> list[dict]:
    """Find TODO, FIXME, HACK, XXX comments indicating tech debt."""
    markers = []
    patterns = re.compile(r'(?://|#|/\*)\s*(TODO|FIXME|HACK|XXX|TEMP|WORKAROUND)[:\s]+(.*)', re.IGNORECASE)

    for ext in ("*.go", "*.py", "*.rs", "*.ts", "*.tsx", "*.js"):
        for f in REPO_ROOT.rglob(ext):
            if "node_modules" in str(f) or ".git" in str(f):
                continue
            try:
                content = f.read_text(errors="ignore")
                for line_num, line in enumerate(content.split('\n'), 1):
                    m = patterns.search(line)
                    if m:
                        markers.append({
                            "file": str(f.relative_to(REPO_ROOT)),
                            "line": line_num,
                            "type": m.group(1).upper(),
                            "message": m.group(2).strip()[:100],
                        })
            except Exception:
                continue

    return markers


# ── 6. Security Pattern Scanner ──────────────────────────────────────────────

def find_security_issues() -> list[dict]:
    """Find common security anti-patterns."""
    issues = []
    patterns = [
        (r'password\s*=\s*["\'][^"\']{3,}["\']', "hardcoded_password"),
        (r'api[_-]?key\s*=\s*["\'][^"\']{10,}["\']', "hardcoded_api_key"),
        (r'secret\s*=\s*["\'][^"\']{5,}["\']', "hardcoded_secret"),
        (r'exec\(\s*["\']', "shell_injection_risk"),
        (r'eval\(\s*', "eval_usage"),
        (r'fmt\.Sprintf\(\s*"SELECT.*%s', "sql_injection_risk"),
        (r'f"SELECT.*\{', "sql_injection_risk"),
    ]

    for ext in ("*.go", "*.py", "*.rs"):
        if not SERVICES_DIR.exists():
            continue
        for f in SERVICES_DIR.rglob(ext):
            try:
                content = f.read_text(errors="ignore")
                for pattern, issue_type in patterns:
                    for m in re.finditer(pattern, content, re.IGNORECASE):
                        issues.append({
                            "file": str(f.relative_to(REPO_ROOT)),
                            "type": issue_type,
                            "match": m.group(0)[:80],
                        })
            except Exception:
                continue

    return issues[:50]


# ── Main ──────────────────────────────────────────────────────────────────────

def run_analysis(output_json=False, ci_mode=False, threshold=15):
    global MAX_COMPLEXITY
    MAX_COMPLEXITY = threshold

    results = {}
    print("=== 54Bank Static Analysis Pipeline ===\n")

    print("[1/6] Scanning cyclomatic complexity...")
    complex_funcs = scan_complexity()
    results["complexity"] = {"count": len(complex_funcs), "items": complex_funcs[:30]}
    print(f"  {len(complex_funcs)} functions exceed complexity threshold ({threshold})\n")

    print("[2/6] Finding dead exports...")
    dead = find_dead_exports()
    results["dead_exports"] = {"count": len(dead), "items": dead[:20]}
    print(f"  {len(dead)} potentially dead exports\n")

    print("[3/6] Detecting circular dependencies...")
    cycles = find_circular_deps()
    results["circular_deps"] = {"count": len(cycles), "cycles": cycles}
    print(f"  {len(cycles)} circular dependency chains\n")

    print("[4/6] Finding unused imports...")
    unused_imports = find_unused_go_imports()
    results["unused_imports"] = {"count": len(unused_imports), "items": unused_imports[:20]}
    print(f"  {len(unused_imports)} potentially unused imports\n")

    print("[5/6] Scanning tech debt markers...")
    markers = find_tech_debt_markers()
    results["tech_debt"] = {
        "count": len(markers),
        "by_type": {},
        "items": markers[:20],
    }
    for m in markers:
        t = m["type"]
        results["tech_debt"]["by_type"][t] = results["tech_debt"]["by_type"].get(t, 0) + 1
    print(f"  {len(markers)} tech debt markers found\n")

    print("[6/6] Security pattern scan...")
    security = find_security_issues()
    results["security"] = {"count": len(security), "items": security[:20]}
    print(f"  {len(security)} potential security issues\n")

    total = len(complex_funcs) + len(dead) + len(cycles) + len(unused_imports) + len(security)
    results["summary"] = {"total_issues": total, "tech_debt_markers": len(markers)}

    print("=" * 60)
    print(f"TOTAL CODE QUALITY ISSUES: {total}")
    print(f"TECH DEBT MARKERS: {len(markers)}")
    print("=" * 60)

    if output_json:
        print(json.dumps(results, indent=2))

    if ci_mode and total > 0:
        sys.exit(1)

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="54Bank Static Analysis")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--ci", action="store_true")
    parser.add_argument("--threshold", type=int, default=15)
    args = parser.parse_args()
    run_analysis(output_json=args.json, ci_mode=args.ci, threshold=args.threshold)
