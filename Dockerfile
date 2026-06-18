# 54Bank Core Banking Platform — Production Dockerfile
# Multi-stage build: Build client + server, then run in minimal image

FROM node:22-slim AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
RUN pnpm install

COPY . .
RUN pnpm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 banking && \
    adduser --system --uid 1001 --ingroup banking appuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle

# G1: HEALTHCHECK for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"

USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
