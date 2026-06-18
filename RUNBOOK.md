# 54Bank Operations Runbook

## Quick Reference

| Action | Command |
|--------|---------|
| Start dev server | `pnpm run dev` |
| Run tests | `pnpm test` (or `npx vitest run`) |
| Lint & typecheck | `pnpm run lint` |
| Build production | `pnpm run build` |
| Seed database | `psql -f drizzle/seed.sql && psql -f drizzle/seed-remaining.sql` |
| Check health | `curl http://localhost:3000/api/health` |
| View Swagger | `http://localhost:3000/api/docs` |

---

## 1. Development Setup

### Prerequisites
- Node.js 20+ (via Volta recommended)
- PostgreSQL 16+
- pnpm 9+

### Initial Setup
```bash
git clone https://github.com/munisp/NGApp.git
cd NGApp
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Create database and run migrations
createdb ndsep_db
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db -c "SELECT 1"

# Push Drizzle schema to Postgres
npx drizzle-kit push

# Seed database
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db -f drizzle/seed.sql
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db -f drizzle/seed-remaining.sql

# Start development server
pnpm run dev
```

### Environment Variables
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ndsep_db
JWT_SECRET=<at-least-32-chars>   # Required for auth
NODE_ENV=development
ENABLE_AUTH=false                 # Set to true for auth enforcement
PORT=3000
REDIS_URL=redis://localhost:6379  # Optional
KAFKA_BROKERS=localhost:9092      # Optional
```

---

## 2. Health Monitoring

### Health Check Endpoints

```bash
# Full health (includes Postgres, Redis, Kafka status)
curl http://localhost:3000/api/health
# Response: { status: "healthy", checks: { postgres: { status: "connected" }, ... } }

# Simple liveness
curl http://localhost:3000/healthz
# Response: { status: "ok", app: "54bank-core-banking" }

# Readiness probe (for K8s)
curl http://localhost:3000/ready

# Liveness probe (for K8s)
curl http://localhost:3000/live

# Prometheus metrics
curl http://localhost:3000/metrics
```

### Dashboard Verification
```bash
# Verify pages render
curl -s http://localhost:3000/ | head -1
# Should return: <!doctype html>

# Verify API returns data from Postgres
curl -s 'http://localhost:3000/api/db/customers?page=1&limit=3'
# Should return: { items: [...], source: "database" }
```

---

## 3. Database Operations

### Connection
```bash
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db
```

### Check Table Status
```sql
-- Count all tables
SELECT count(*) FROM information_schema.tables 
WHERE table_schema='public' AND table_type='BASE TABLE';
-- Expected: 267

-- Check for empty tables
SELECT relname, n_live_tup FROM pg_stat_user_tables 
WHERE n_live_tup = 0 ORDER BY relname;
-- Expected: 0 rows (all tables should be seeded)

-- Total rows
SELECT sum(n_live_tup) FROM pg_stat_user_tables;
-- Expected: 3,443+
```

### Re-seed Database
```bash
# Core banking + channel banking
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db -f drizzle/seed.sql

# Remaining tables (AML, infra, security)
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db -f drizzle/seed-remaining.sql
```

### Schema Migrations
```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Push schema to database (destructive in dev)
npx drizzle-kit push

# View current schema
npx drizzle-kit studio
```

### Backup & Restore
```bash
# Backup
pg_dump -h localhost -U <user> -d ndsep_db -F custom -f backup_$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -U <user> -d ndsep_db backup_20260512.dump
```

---

## 4. Authentication

### Test Accounts (Development)
| Email | Password | Role |
|-------|----------|------|
| admin@54bank.ng | admin | admin |
| ops@54bank.ng | ops123 | operations |
| compliance@54bank.ng | comp123 | compliance |
| teller@54bank.ng | teller123 | teller |
| auditor@54bank.ng | audit123 | auditor |
| customer@54bank.ng | cust123 | customer |

### Login Flow
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@54bank.ng","password":"admin"}'
# Returns: { accessToken, refreshToken, user: { role: "admin" } }

# Use token
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# Refresh
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'

# Logout (blacklists token)
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <accessToken>"
```

### MFA Enrollment
```bash
# Enroll (returns TOTP secret + QR code URL)
curl -X POST http://localhost:3000/api/auth/mfa/enroll \
  -H "Authorization: Bearer <token>"
# Returns: { secret, otpauthUrl, backupCodes, qrCodeUrl }

# Verify
curl -X POST http://localhost:3000/api/auth/mfa/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'

# Status
curl http://localhost:3000/api/auth/mfa/status \
  -H "Authorization: Bearer <token>"
```

---

## 5. Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
fuser 3000/tcp
# Kill existing process
fuser -k 3000/tcp

# Check Postgres connection
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db -c "SELECT 1"

# Check for TypeScript errors
npx tsc --noEmit
```

### Pages Show "No Records Yet"
```bash
# Check if table has data
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db \
  -c "SELECT count(*) FROM <table_name>"

# Re-seed if empty
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db \
  -f drizzle/seed.sql
PGPASSWORD=<password> psql -h localhost -U <user> -d ndsep_db \
  -f drizzle/seed-remaining.sql
```

### API Returns HTML Instead of JSON
The route may not be registered. Check:
```bash
# DB routes (should return JSON)
curl http://localhost:3000/api/db/<table-name>

# If that returns HTML, the table name may be wrong
# Check drizzle/schema.ts for the correct table name
```

### Tests Failing
```bash
# Run all tests
npx vitest run

# Run specific test file
npx vitest run server/__tests__/auth.test.ts

# Integration tests need a running server
pnpm run dev &
npx vitest run server/__tests__/integration.test.ts
```

### MFA Returns 401
Ensure `registerMfaRoutes(app)` is called AFTER `app.use(authMiddleware())` in `server/index.ts`. If MFA routes are registered before auth middleware, `req.user` will be undefined.

---

## 6. CI/CD Pipeline

### GitHub Actions Checks (7)
| Check | What it does | Typical duration |
|-------|-------------|------------------|
| Lint & Typecheck | `pnpm run lint` + `tsc --noEmit` | 2 min |
| Build | `pnpm run build` | 3 min |
| Unit Tests | `npx vitest run` | 30 sec |
| Go Services | Compiles all 180 Go services | 5 min |
| Rust Services | Compiles all 139 Rust services | 25-35 min |
| Python Services | Validates all 77 Python services | 3 min |
| Docker Build | Builds main Dockerfile | 5 min |

### Deploy Staging
Triggered automatically when PR is merged to `main`. Deploys to staging environment.

---

## 7. Production Deployment

### Docker
```bash
# Build
docker build -t 54bank:latest .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e NODE_ENV=production \
  54bank:latest
```

### Docker Compose (Full Stack)
```bash
docker-compose up -d
# Starts: app, postgres, redis, kafka, keycloak
```

### Kubernetes (Helm)
```bash
helm install 54bank ./helm \
  --set image.tag=latest \
  --set postgres.host=<rds-endpoint> \
  --set redis.host=<elasticache-endpoint>
```

### Terraform (AWS)
```bash
cd terraform
terraform init
terraform plan
terraform apply
# Creates: EKS cluster, RDS instance, ElastiCache, MSK
```

---

## 8. Incident Response

### Severity Levels
| Level | Response Time | Example |
|-------|--------------|---------|
| P1 | 15 min | Payment processing down, data breach |
| P2 | 1 hour | Degraded performance, partial outage |
| P3 | 4 hours | Single service failure, non-critical bug |
| P4 | Next business day | UI issue, documentation error |

### Escalation
1. Check `/api/health` for system status
2. Check `/metrics` for performance anomalies
3. Review application logs
4. Check database connectivity and query performance
5. Escalate to engineering team if unresolved after 30 min
