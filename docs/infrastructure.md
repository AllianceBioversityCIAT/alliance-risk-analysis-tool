# Infrastructure Blueprint — CGIAR Risk Intelligence Tool

> **Last updated:** 2026-07-27  
> **Architecture tier:** **Robust** (see [TRD §2](trd/trd.md) — ADR index)  
> **Detailed ops docs:** [`docs/infrastructure/`](infrastructure/)

Single-stack AWS serverless deployment. Environments: **dev**, **staging**, **production**.

---

## 1. Target Environment

| Setting | Value |
|---------|-------|
| Cloud provider | AWS |
| Region | Configured per deploy profile (default: team standard) |
| IaC | AWS CDK v2 (`infra/`) + pre-synthesized CloudFormation (`infra/cfn/`) |
| Frontend hosting | S3 + CloudFront (static Next.js export) |
| Backend | API Gateway HTTP API → NestJS Lambda |
| CI/CD pattern | Documented in [`docs/infrastructure/CI-CD.md`](infrastructure/CI-CD.md) |

---

## 2. Core Cloud Components

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Auth | Cognito User Pool | Email login, admin group, token issuance |
| API | API Gateway HTTP API + Lambda (ARM64, Node 22) | REST `/api/*`, 30s timeout |
| Worker | Lambda (15 min timeout) | Async Bedrock/Textract jobs |
| Database | RDS PostgreSQL 15 | App data via Prisma |
| Files | S3 (files + web buckets) | Uploads, generated PDFs, static SPA |
| CDN | CloudFront | HTTPS, SPA fallback to `/index.html` |
| AI | Bedrock (Kimi K2.5) | Gap, risk, report, preview agents |
| OCR | Textract | PDF text extraction |
| Secrets | Secrets Manager | DB credentials, worker admin token |

Full resource inventory: [`docs/infrastructure/README.md`](infrastructure/README.md), [`infra/CLAUDE.md`](../infra/CLAUDE.md)

---

## 3. Deployment Strategy

### Order (infra or schema changes)

```
1. pnpm --filter @alliance-risk/infra cfn:deploy dev   # or cdk deploy
2. pnpm migrate:remote                                  # Prisma on private RDS
3. pnpm deploy:api                                      # esbuild bundle → S3 → Lambda
4. pnpm deploy:web                                      # static export → S3 → CloudFront invalidation
```

### Code-only changes

```bash
pnpm deploy:all    # API + Web (includes migrate:remote when scripted)
```

### Environment parameters

`infra/cfn/parameters.json` — per-env `VpcId`, `SubnetIds`, `CorsOrigin`, deploy bucket keys.

| Environment | CORS (typical) |
|-------------|----------------|
| dev | `*` |
| staging | `https://staging.alliance-risk.example.com` |
| production | `https://app.alliance-risk.example.com` |

---

## 4. Network & Security Architecture

```
Internet → CloudFront → S3 (static) | API Gateway → API Lambda (VPC)
                                              ↓
                                         Worker Lambda (VPC)
                                              ↓
                                    RDS PostgreSQL (private subnet)
                                    Secrets Manager (VPC endpoint)
```

### IAM boundaries

- **API Lambda:** Cognito admin, Bedrock invoke, S3 R/W on file bucket, invoke Worker only
- **Worker Lambda:** Same minus Lambda invoke — no worker-spawns-worker

### Known MVP caveats (harden for prod)

| Issue | Mitigation path |
|-------|-----------------|
| Dev CORS `*` | Lock to CloudFront origin in production |
| RDS exposure | Private subnet + security groups (staging/prod) |
| No WAF | Add rate-based WAF on API Gateway |

---

## 5. Infrastructure Rules & Constraints

1. **DB credentials** — Secrets Manager only; never commit to git or hardcode in Lambda env templates checked into repo
2. **Migrations** — `pnpm migrate:remote` via authenticated Worker `run-sql`; not direct RDS from laptop
3. **Lambda bundles** — esbuild via `scripts/deploy-api.sh`; externalize heavy deps per script config
4. **Static web** — `output: 'export'`; all asset paths known at build time
5. **Stack destroy** — File bucket RETAIN policy; web bucket may be recreated
6. **Local dev never hits prod RDS** — use local PostgreSQL in `packages/api/.env`

### Disposable vs governed

| Class | Rule |
|-------|------|
| **Local environment** | Disposable — agents may start, seed, reset freely |
| **Cloud (dev/staging/prod)** | Governed — deploy only via documented commands above; no improvised infra changes |

---

## 6. Local Environment

### Primary route (recommended)

Native pnpm dev stack with local PostgreSQL — no Docker Compose in repo today.

**Pre-check:**

```bash
# PostgreSQL running locally
psql -h localhost -p 5432 -U "$USER" -d postgres -c "SELECT 1"

# Node + pnpm
node -v && pnpm -v
```

**Setup (first time):**

```bash
pnpm install
createdb alliance_risk   # if database doesn't exist

# packages/api/.env
# DATABASE_URL=postgresql://<your-user>@localhost:5432/alliance_risk

pnpm --filter @alliance-risk/shared build
pnpm --filter @alliance-risk/api exec prisma migrate deploy
npx --prefix packages/api tsx prisma/seed.ts
```

**Start:**

```bash
pnpm dev    # API :3001 + Web :3000 concurrently
```

**Seed / reset:**

```bash
npx --prefix packages/api tsx prisma/seed.ts
# Full reset: drop/recreate DB + migrate deploy + seed
```

**Health check:**

| Service | URL / command |
|---------|---------------|
| API | `curl http://localhost:3001/api` → `{ "status": "ok" }` |
| Web | `http://localhost:3000` → login page |
| DB | `pnpm --filter @alliance-risk/api exec prisma db pull` (connectivity) |

**URLs / ports:**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001/api |
| PostgreSQL | localhost:5432 |

### Fallback route (no local PostgreSQL)

1. Use a cloud dev database URL in `packages/api/.env` (team-provided; VPN if required)
2. Run `pnpm dev:api` and `pnpm dev:web` separately if concurrent script fails
3. Skip seed if no DB access — UI login will fail until DB is reachable

### Docker (future)

Docker Compose is **not** scaffolded. If added later, document here as primary route and keep native pnpm as fallback.

---

## Related documentation

- [`docs/infrastructure/QUICK-REFERENCE.md`](infrastructure/QUICK-REFERENCE.md)
- [`docs/infrastructure/staging-setup.md`](infrastructure/staging-setup.md)
- [`docs/runbooks/docx-extraction.md`](runbooks/docx-extraction.md)
