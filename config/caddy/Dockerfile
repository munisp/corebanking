# ═══════════════════════════════════════════════════════════════════════════════
# 54Bank Caddy Gateway — Custom Build with Required Modules
# ═══════════════════════════════════════════════════════════════════════════════
# Modules included:
#   - caddy-rate-limit    : Distributed rate limiting (per-IP, per-tenant)
#   - caddy-security      : JWT validation, OIDC, OAuth2 (Keycloak integration)
#   - caddy-storage-redis : Redis-backed TLS cert storage (cluster-safe)
#   - caddy-waf           : Lightweight WAF rules (complement to OpenAppSec)
#   - caddy-coraza-waf    : OWASP Coraza WAF integration
#   - caddy-events-exec   : Execute commands on Caddy events (cert renewal hooks)
# ═══════════════════════════════════════════════════════════════════════════════

FROM caddy:2.9-builder AS builder

RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit \
    --with github.com/greenpau/caddy-security \
    --with github.com/pberkel/caddy-storage-redis \
    --with github.com/corazawaf/coraza-caddy/v2 \
    --with github.com/mholt/caddy-events-exec \
    --with github.com/caddyserver/caddy/v2=github.com/caddyserver/caddy/v2@latest

FROM caddy:2.9-alpine

# Copy the custom Caddy binary with all modules
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Create required directories
RUN mkdir -p /etc/caddy /data/caddy /config/caddy /var/log/caddy

# Copy configuration files
COPY Caddyfile /etc/caddy/Caddyfile
COPY caddy.json /etc/caddy/caddy.json

# Expose HTTP, HTTPS, and HTTP/3 (QUIC) ports
EXPOSE 80 443 443/udp 2019

# Health check using Caddy's admin API
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:2019/config/ || exit 1

ENTRYPOINT ["/usr/bin/caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
