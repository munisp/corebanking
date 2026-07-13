#!/bin/bash
# Runs during docker build. Compiles Go/Rust services, installs Python/Node deps.
set -e

IFS=',' read -ra SVCLIST <<< "$SERVICES"

for svc in "${SVCLIST[@]}"; do
    svc=$(echo "$svc" | xargs)  # trim whitespace
    dir="/app/services/$svc"

    if [ ! -d "$dir" ]; then
        echo "[build] SKIP $svc — directory not found"
        continue
    fi

    echo "[build] Processing $svc..."

    if [ -f "$dir/go.mod" ]; then
        echo "[build] Go → $svc"
        cd "$dir"
        go mod download 2>/dev/null || true
        # Try static build first; fall back to CGO-enabled build for services that need CGO (e.g. tigerbeetle-go)
        if ! CGO_ENABLED=0 GOOS=linux go build -o /app/bin/$svc . 2>&1; then
            echo "[build] Static build failed for $svc, retrying with CGO enabled..."
            CGO_ENABLED=1 GOOS=linux go build -o /app/bin/$svc . 2>&1 || echo "[build] WARN: go build failed for $svc"
        fi
        # Remove non-executable outputs produced when building library packages (package != main)
        if [ -f "/app/bin/$svc" ] && [ ! -x "/app/bin/$svc" ]; then
            echo "[build] WARN: $svc binary is not executable (library package?), removing"
            rm -f "/app/bin/$svc"
        fi

    elif [ -f "$dir/Cargo.toml" ]; then
        echo "[build] Rust → $svc"
        cd "$dir"
        cargo build --release 2>&1 || echo "[build] WARN: cargo build failed for $svc"
        # Copy binary — name may differ from service name
        binary=$(find "$dir/target/release" -maxdepth 1 -type f -executable 2>/dev/null | head -1)
        if [ -n "$binary" ]; then
            cp "$binary" /app/bin/$svc
        fi

    elif [ -f "$dir/package.json" ]; then
        echo "[build] Node → $svc"
        cd "$dir"
        npm install 2>&1 || true
        npm run build 2>&1 || echo "[build] WARN: npm build failed for $svc"

    fi

    # Always install Python requirements when present (handles pure-Python and multi-language services)
    if [ -f "$dir/requirements.txt" ]; then
        echo "[build] Python deps → $svc"
        pip install --no-cache-dir -r "$dir/requirements.txt" 2>&1 || echo "[build] WARN: pip install failed for $svc"
    fi
done

echo "[build] Done"
