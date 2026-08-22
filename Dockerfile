# ── Gateway (BFF) — Express server (infrastructure/new/server) ──────────────
# Referenced by docker-compose.yml service "gateway" (build.context: .,
# dockerfile: Dockerfile). Multi-stage: npm ci -> esbuild bundle -> slim runtime.

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
# Server source tree (server/, shared/, drizzle/ all live under infrastructure/new)
COPY infrastructure/new ./infrastructure/new
RUN npx esbuild infrastructure/new/server/index.ts \
      --platform=node --packages=external --bundle --format=esm \
      --outfile=dist/index.js

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/index.js"]
