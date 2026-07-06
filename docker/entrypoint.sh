#!/bin/bash
# Generates /etc/supervisor/conf.d/services.conf then starts supervisord.
set -e

CONF=/etc/supervisor/conf.d/services.conf
> "$CONF"

IFS=',' read -ra SVCLIST <<< "$SERVICES"
PORT=${PORT_BASE:-9100}

for svc in "${SVCLIST[@]}"; do
    svc=$(echo "$svc" | xargs)
    dir="/app/services/$svc"

    # Determine start command
    if [ -f "/app/bin/$svc" ]; then
        # Pre-compiled Go or Rust binary
        cmd="/app/bin/$svc"
        workdir="$dir"

    elif [ -f "$dir/main.py" ]; then
        if grep -qE "^app\s*=" "$dir/main.py"; then
            cmd="uvicorn main:app --host 0.0.0.0 --port $PORT"
        else
            cmd="python main.py"
        fi
        workdir="$dir"

    elif [ -f "$dir/service.py" ]; then
        cmd="python service.py"
        workdir="$dir"

    elif [ -f "$dir/app.py" ]; then
        if grep -qE "^app\s*=" "$dir/app.py"; then
            cmd="uvicorn app:app --host 0.0.0.0 --port $PORT"
        else
            cmd="python app.py"
        fi
        workdir="$dir"

    elif [ -f "$dir/package.json" ]; then
        if [ -f "$dir/dist/index.js" ]; then
            cmd="node dist/index.js"
        elif [ -f "$dir/dist/index.html" ]; then
            cmd="python3 -m http.server $PORT --directory dist"
        else
            cmd="npm start"
        fi
        workdir="$dir"

    else
        echo "[entrypoint] WARN: no known entry for $svc — skipping"
        PORT=$((PORT + 1))
        continue
    fi

    cat >> "$CONF" << EOF
[program:${svc}]
command=${cmd}
directory=${workdir}
environment=PORT="${PORT}",APP_PORT="${PORT}",APP_HOST="0.0.0.0",DAPR_HOST="${DAPR_HOST:-127.0.0.1}",DAPR_HTTP_PORT="${DAPR_HTTP_PORT:-3500}"
autostart=true
autorestart=true
startretries=3
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
redirect_stderr=false

EOF

    echo "[entrypoint] Registered $svc on port $PORT"
    PORT=$((PORT + 1))
done

echo "[entrypoint] Starting supervisord with $(echo $SERVICES | tr ',' '\n' | wc -l) services..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
