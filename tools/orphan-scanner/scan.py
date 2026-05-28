#!/usr/bin/env python3
"""
54Bank Orphan Feature Scanner
Continuously finds orphan features, dead endpoints, disconnected services,
and unused code across the entire platform.

Usage:
  python3 tools/orphan-scanner/scan.py [--json] [--fix] [--ci]
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
MOBILE_DIR = REPO_ROOT / "mobile" / "flutter" / "lib"
PWA_DIR = REPO_ROOT / "pwa" / "src"
K8S_DIR = REPO_ROOT / "k8s"

# ── 1. Route Inventory ───────────────────────────────────────────────────────

def extract_go_routes(service_path: Path) -> list[dict]:
    """Extract HTTP route registrations from Go services."""
    routes = []
    main_go = service_path / "main.go"
    if not main_go.exists():
        return routes
    content = main_go.read_text(errors="ignore")

    # Match: http.HandleFunc("/v1/...", handler)
    for m in re.finditer(r'HandleFunc\(\s*"([^"]+)"', content):
        routes.append({"path": m.group(1), "method": "ANY", "service": service_path.name})

    # Match: mux.HandleFunc("METHOD /path", ...)
    for m in re.finditer(r'HandleFunc\(\s*"(GET|POST|PUT|DELETE|PATCH)\s+([^"]+)"', content):
        routes.append({"path": m.group(2), "method": m.group(1), "service": service_path.name})

    # Match: r.HandleFunc("/path").Methods("GET")
    for m in re.finditer(r'HandleFunc\(\s*"([^"]+)"\)\.Methods\(\s*"(\w+)"', content):
        routes.append({"path": m.group(1), "method": m.group(2), "service": service_path.name})

    return routes


def extract_python_routes(service_path: Path) -> list[dict]:
    """Extract Flask/FastAPI route registrations from Python services."""
    routes = []
    main_py = service_path / "main.py"
    if not main_py.exists():
        return routes
    content = main_py.read_text(errors="ignore")

    # Flask: @app.route("/path", methods=["GET"])
    for m in re.finditer(r'@app\.route\(\s*"([^"]+)"(?:.*?methods=\[([^\]]+)\])?', content):
        methods = m.group(2) or '"GET"'
        for method in re.findall(r'"(\w+)"', methods):
            routes.append({"path": m.group(1), "method": method, "service": service_path.name})

    # Match: app.add_url_rule
    for m in re.finditer(r'add_url_rule\(\s*"([^"]+)"', content):
        routes.append({"path": m.group(1), "method": "ANY", "service": service_path.name})

    return routes


def extract_rust_routes(service_path: Path) -> list[dict]:
    """Extract Actix/Axum route registrations from Rust services."""
    routes = []
    main_rs = service_path / "src" / "main.rs"
    if not main_rs.exists():
        return routes
    content = main_rs.read_text(errors="ignore")

    # Match: .route("/path", web::get().to(handler))
    for m in re.finditer(r'\.route\(\s*"([^"]+)"', content):
        routes.append({"path": m.group(1), "method": "ANY", "service": service_path.name})

    # Match: #[get("/path")]
    for m in re.finditer(r'#\[(get|post|put|delete)\(\s*"([^"]+)"\s*\)\]', content):
        routes.append({"path": m.group(2), "method": m.group(1).upper(), "service": service_path.name})

    return routes


def scan_all_routes() -> list[dict]:
    """Scan all services and extract registered routes."""
    all_routes = []
    if not SERVICES_DIR.exists():
        return all_routes

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        all_routes.extend(extract_go_routes(service_dir))
        all_routes.extend(extract_python_routes(service_dir))
        all_routes.extend(extract_rust_routes(service_dir))

    return all_routes


# ── 2. UI Navigation Inventory ───────────────────────────────────────────────

def extract_ui_links() -> list[dict]:
    """Extract all navigation links from frontend UI components."""
    links = []

    # React admin sidebar
    sidebar_file = CLIENT_DIR / "components" / "ArchiveAdminSidebar.tsx"
    if sidebar_file.exists():
        content = sidebar_file.read_text(errors="ignore")
        for m in re.finditer(r'path:\s*"([^"]+)"', content):
            links.append({"path": m.group(1), "source": "admin-sidebar"})

    # React dashboard layout
    dashboard_file = CLIENT_DIR / "components" / "DashboardLayout.tsx"
    if dashboard_file.exists():
        content = dashboard_file.read_text(errors="ignore")
        for m in re.finditer(r'path:\s*"([^"]+)"', content):
            links.append({"path": m.group(1), "source": "dashboard-layout"})

    # Flutter mobile drawer
    main_dart = MOBILE_DIR / "main.dart"
    if main_dart.exists():
        content = main_dart.read_text(errors="ignore")
        for m in re.finditer(r"pushNamed\(context,\s*'([^']+)'\)", content):
            links.append({"path": m.group(1), "source": "flutter-drawer"})

    # PWA navigation
    app_js = PWA_DIR / "app.js"
    if app_js.exists():
        content = app_js.read_text(errors="ignore")
        for m in re.finditer(r'href="#([^"]+)"', content):
            links.append({"path": f"#{m.group(1)}", "source": "pwa-nav"})
        for m in re.finditer(r"hash:\s*'([^']+)'", content):
            links.append({"path": f"#{m.group(1)}", "source": "pwa-sidebar"})

    return links


# ── 3. Service Dependency Graph ───────────────────────────────────────────────

def build_dependency_graph() -> dict:
    """Build inter-service dependency graph from HTTP/gRPC client calls."""
    graph = defaultdict(set)  # service -> set of services it calls

    if not SERVICES_DIR.exists():
        return graph

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue
        svc_name = service_dir.name

        for ext in ("*.go", "*.py", "*.rs"):
            for f in service_dir.rglob(ext):
                content = f.read_text(errors="ignore")
                # Match HTTP calls to other services
                for m in re.finditer(r'(?:http://|https://)?(\w[\w-]+)(?::\d+)?/v1/', content):
                    target = m.group(1)
                    if target != svc_name and target != "localhost":
                        graph[svc_name].add(target)
                # Match gRPC calls
                for m in re.finditer(r'grpc_call\(\s*"([^"]+)"', content):
                    graph[svc_name].add(m.group(1))

    return {k: list(v) for k, v in graph.items()}


def find_orphan_services(graph: dict) -> list[str]:
    """Find services that are never called by any other service."""
    all_services = set()
    called_services = set()

    if SERVICES_DIR.exists():
        for d in SERVICES_DIR.iterdir():
            if d.is_dir():
                all_services.add(d.name)

    for targets in graph.values():
        called_services.update(targets)

    # Infrastructure services that are entry points (not called by others)
    entry_points = {
        "api-gateway", "apisix-gateway", "web-app", "admin-app",
        "ml-inference-server", "lakehouse-server", "batch-eod",
    }

    orphans = all_services - called_services - entry_points
    return sorted(orphans)


# ── 4. Feature Flag Audit ─────────────────────────────────────────────────────

def audit_feature_flags() -> dict:
    """Cross-reference feature flag definitions vs usage."""
    flags_file = CLIENT_DIR / "hooks" / "useFeatureFlags.ts"
    if not flags_file.exists():
        flags_file = CLIENT_DIR / "hooks" / "useFeatureFlags.tsx"
    if not flags_file.exists():
        return {"defined": [], "used": [], "unused": [], "missing": []}

    content = flags_file.read_text(errors="ignore")
    defined_flags = set(re.findall(r'"([^"]+)":\s*(?:true|false)', content))

    # Find all flag usage across the codebase
    used_flags = set()
    for f in CLIENT_DIR.rglob("*.tsx"):
        fc = f.read_text(errors="ignore")
        for m in re.finditer(r'isEnabled\(\s*"([^"]+)"\s*\)', fc):
            used_flags.add(m.group(1))

    return {
        "defined": sorted(defined_flags),
        "used": sorted(used_flags),
        "unused": sorted(defined_flags - used_flags),
        "missing": sorted(used_flags - defined_flags),
    }


# ── 5. Dead Code Detection ───────────────────────────────────────────────────

def find_dead_handlers() -> list[dict]:
    """Find handler functions that are defined but never registered as routes."""
    dead = []
    if not SERVICES_DIR.exists():
        return dead

    for service_dir in sorted(SERVICES_DIR.iterdir()):
        if not service_dir.is_dir():
            continue

        for ext, func_pattern in [
            ("*.go", r'func\s+(\w+Handler)\('),
            ("*.py", r'def\s+(handle_\w+|endpoint_\w+)\('),
        ]:
            for f in service_dir.rglob(ext):
                content = f.read_text(errors="ignore")
                handlers = set(re.findall(func_pattern, content))
                # Check if any handler is referenced in route registration
                for h in handlers:
                    # Look for the handler name being used (not just defined)
                    uses = len(re.findall(rf'\b{h}\b', content))
                    if uses <= 1:  # Only the definition itself
                        dead.append({
                            "service": service_dir.name,
                            "handler": h,
                            "file": str(f.relative_to(REPO_ROOT)),
                        })

    return dead


# ── 6. Database Table Usage ───────────────────────────────────────────────────

def find_unused_db_tables() -> dict:
    """Find tables defined in schema but never referenced in service code."""
    schema_tables = set()

    # Extract from Drizzle schema
    for schema_file in (CLIENT_DIR / "..").rglob("schema.ts"):
        content = schema_file.read_text(errors="ignore")
        for m in re.finditer(r'pgTable\(\s*"(\w+)"', content):
            schema_tables.add(m.group(1))

    # Extract from SQL seeds
    for sql_file in REPO_ROOT.rglob("*.sql"):
        content = sql_file.read_text(errors="ignore")
        for m in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)', content, re.IGNORECASE):
            schema_tables.add(m.group(1))

    # Find tables referenced in service code
    referenced_tables = set()
    if SERVICES_DIR.exists():
        for f in SERVICES_DIR.rglob("*"):
            if f.suffix in (".go", ".py", ".rs") and f.is_file():
                content = f.read_text(errors="ignore")
                for table in schema_tables:
                    if table in content:
                        referenced_tables.add(table)

    unused = schema_tables - referenced_tables
    return {
        "total_tables": len(schema_tables),
        "referenced": len(referenced_tables),
        "unused": sorted(unused),
    }


# ── 7. React Page Coverage ───────────────────────────────────────────────────

def find_unlinked_pages() -> list[str]:
    """Find React page components that exist but aren't linked in any navigation."""
    pages_dir = CLIENT_DIR / "pages"
    if not pages_dir.exists():
        return []

    all_pages = set()
    for f in pages_dir.iterdir():
        if f.suffix in (".tsx", ".ts", ".jsx", ".js"):
            all_pages.add(f.stem)

    # Find pages referenced in routing or navigation
    linked_pages = set()
    for f in CLIENT_DIR.rglob("*.tsx"):
        content = f.read_text(errors="ignore")
        for page in all_pages:
            if page in content:
                linked_pages.add(page)

    return sorted(all_pages - linked_pages)


# ── 8. K8s Manifest Audit ────────────────────────────────────────────────────

def audit_k8s_manifests() -> dict:
    """Check K8s manifests for services without corresponding code."""
    k8s_services = set()
    if K8S_DIR.exists():
        for f in K8S_DIR.rglob("*.yaml"):
            content = f.read_text(errors="ignore")
            for m in re.finditer(r'name:\s+(\S+)', content):
                name = m.group(1).strip()
                if not name.startswith("{{") and len(name) > 3:
                    k8s_services.add(name)

    code_services = set()
    if SERVICES_DIR.exists():
        for d in SERVICES_DIR.iterdir():
            if d.is_dir():
                code_services.add(d.name)

    return {
        "k8s_only": sorted(k8s_services - code_services)[:20],
        "code_only": sorted(code_services - k8s_services)[:20],
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def run_scan(output_json=False, ci_mode=False):
    """Run all orphan detection scans."""
    results = {}

    print("=== 54Bank Orphan Feature Scanner ===\n")

    # 1. Route inventory
    print("[1/8] Scanning service routes...")
    routes = scan_all_routes()
    results["routes"] = {"total": len(routes), "sample": routes[:10]}
    print(f"  Found {len(routes)} registered routes\n")

    # 2. UI links
    print("[2/8] Scanning UI navigation links...")
    ui_links = extract_ui_links()
    results["ui_links"] = {"total": len(ui_links), "by_source": {}}
    for link in ui_links:
        src = link["source"]
        results["ui_links"]["by_source"][src] = results["ui_links"]["by_source"].get(src, 0) + 1
    print(f"  Found {len(ui_links)} UI navigation links\n")

    # 3. Dependency graph
    print("[3/8] Building service dependency graph...")
    graph = build_dependency_graph()
    orphan_services = find_orphan_services(graph)
    results["dependency_graph"] = {
        "services_with_deps": len(graph),
        "orphan_services": orphan_services[:30],
        "orphan_count": len(orphan_services),
    }
    print(f"  {len(graph)} services have outbound deps")
    print(f"  {len(orphan_services)} potentially orphaned services\n")

    # 4. Feature flags
    print("[4/8] Auditing feature flags...")
    flags = audit_feature_flags()
    results["feature_flags"] = flags
    print(f"  {len(flags['defined'])} defined, {len(flags['used'])} used")
    print(f"  {len(flags['unused'])} unused, {len(flags['missing'])} missing\n")

    # 5. Dead handlers
    print("[5/8] Finding dead handler functions...")
    dead = find_dead_handlers()
    results["dead_handlers"] = {"count": len(dead), "items": dead[:20]}
    print(f"  {len(dead)} potentially dead handlers\n")

    # 6. Database tables
    print("[6/8] Checking database table usage...")
    db = find_unused_db_tables()
    results["database"] = db
    print(f"  {db['total_tables']} tables, {len(db['unused'])} unused\n")

    # 7. Unlinked pages
    print("[7/8] Finding unlinked React pages...")
    unlinked = find_unlinked_pages()
    results["unlinked_pages"] = {"count": len(unlinked), "pages": unlinked[:30]}
    print(f"  {len(unlinked)} unlinked page components\n")

    # 8. K8s manifests
    print("[8/8] Auditing K8s manifests...")
    k8s = audit_k8s_manifests()
    results["k8s_audit"] = k8s
    print(f"  K8s-only: {len(k8s['k8s_only'])}, Code-only: {len(k8s['code_only'])}\n")

    # Summary
    total_issues = (
        len(orphan_services) + len(flags["unused"]) + len(flags["missing"])
        + len(dead) + len(db["unused"]) + len(unlinked)
    )
    results["summary"] = {
        "total_issues": total_issues,
        "orphan_services": len(orphan_services),
        "unused_flags": len(flags["unused"]),
        "missing_flags": len(flags["missing"]),
        "dead_handlers": len(dead),
        "unused_tables": len(db["unused"]),
        "unlinked_pages": len(unlinked),
    }

    print("=" * 60)
    print(f"TOTAL ISSUES: {total_issues}")
    print(f"  Orphan services: {len(orphan_services)}")
    print(f"  Unused feature flags: {len(flags['unused'])}")
    print(f"  Missing feature flags: {len(flags['missing'])}")
    print(f"  Dead handlers: {len(dead)}")
    print(f"  Unused DB tables: {len(db['unused'])}")
    print(f"  Unlinked pages: {len(unlinked)}")
    print("=" * 60)

    if output_json:
        print(json.dumps(results, indent=2))

    # CI mode: exit with failure if issues found
    if ci_mode and total_issues > 0:
        sys.exit(1)

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="54Bank Orphan Feature Scanner")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--ci", action="store_true", help="Exit with error code if issues found")
    args = parser.parse_args()
    run_scan(output_json=args.json, ci_mode=args.ci)
