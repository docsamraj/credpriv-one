# RCA & CAPA — CredPriv One Railway Deployment Failures

**Document ID:** RCA-CAPA-2026-001  
**Date:** 2026-07-03  
**Scope:** GitHub → Railway deployment (`@credpriv/backend`, `@credpriv/frontend`, Postgres)  
**Status:** Corrective actions in progress; preventive controls added

---

## 1. Problem Statement

CredPriv One was pushed to GitHub and deployed to Railway. The **frontend deployed successfully**, but the **backend repeatedly failed to build** across multiple deployment attempts. Postgres had a separate configuration issue (PGDATA). Login worked locally but not in production until backend + DB are healthy.

---

## 2. Timeline of Failures

| # | When | Symptom | Commit / Context |
|---|------|---------|------------------|
| 1 | Local first run | Login failed — `Can't reach database server at localhost:5432` | Postgres not running locally |
| 2 | Railway backend build #1 | `Cannot find module '@credpriv/shared'` / `Prisma.InputJsonValue` | TypeScript + monorepo issues |
| 3 | Railway backend build #2 | `cd ../shared: No such file or directory` | Root Directory = `backend/` (no sibling `shared/`) |
| 4 | Railway init | `service config at 'backend/railway.toml' not found` | Config file deleted during refactor |
| 5 | Railway Docker build | `npm ci` → `tsc` failed in `@credpriv/shared` | `prepare` script ran before source copied |
| 6 | Railway Docker build | `npm ci` → `npm run build` → `tsc` failed | `NODE_ENV=production` skipped devDependencies (TypeScript) |
| 7 | Postgres service | `PGDATA variable does not start with expected volume mount path` | Manual/incorrect Postgres env or volume config |
| 8 | User testing | Browser opened `D:/CredPriv Pro/https:/YOUR-BACKEND-URL/health` | Placeholder URL used literally, not replaced |

---

## 3. Root Cause Analysis (5 Whys)

### Failure A — Monorepo not in Railway build context

```
Why did backend build fail with "cd ../shared not found"?
→ Build command referenced ../shared relative to backend/

Why was ../shared missing?
→ Railway Root Directory was set to backend/, so only backend/ was in build context

Why was Root Directory backend/?
→ Initial scaffold assumed per-package deploy; npm workspace shared/ lives at repo root

Why wasn't this caught before push?
→ No CI pipeline validated Docker/Railway build before deploy

ROOT CAUSE: Monorepo architecture (shared workspace) incompatible with backend-only Root Directory on Railway.
```

### Failure B — Lifecycle scripts during `npm ci`

```
Why did tsc run during npm ci?
→ shared/package.json had "prepare": "npm run build" which runs on npm install/ci

Why did prepare fail?
→ Early Dockerfile copied only package.json files first; shared/src/ did not exist yet

ROOT CAUSE: npm lifecycle hook (prepare) executed before source files were available in Docker build.
```

### Failure C — NODE_ENV=production during build

```
Why did tsc fail even after removing prepare?
→ TypeScript is a devDependency; Railway sets NODE_ENV=production during build

Why were devDependencies skipped?
→ npm ci omits devDependencies when NODE_ENV=production

ROOT CAUSE: Build-time tools (typescript, prisma CLI) classified as devDependencies but required at build time on Railway.
```

### Failure D — Conflicting build configs

```
Why might Railway still fail after Dockerfile fix?
→ root nixpacks.toml coexisted with Dockerfile.backend; builder selection ambiguous

Why multiple configs?
→ Iterative fixes added nixpacks + Dockerfile + railway.toml without removing obsolete files

ROOT CAUSE: Competing build configurations (Nixpacks vs Dockerfile) without single source of truth.
```

### Failure E — Postgres PGDATA

```
Why did Postgres crash-loop?
→ PGDATA env did not match Railway volume mount path /var/lib/postgresql/data

ROOT CAUSE: Manual override of Postgres template variables or corrupted volume mount state.
```

---

## 4. Contributing Factors

| Factor | Impact |
|--------|--------|
| No pre-deploy CI | Broken builds reached Railway repeatedly |
| Monorepo + multi-service deploy complexity | Backend depends on `shared/` outside its folder |
| Railway UI defaults (NODE_ENV=production) | Skips build-time devDependencies |
| Documentation used placeholder URLs | User tested invalid health-check URL |
| No local Docker build before push | Dockerfile issues discovered only on Railway |

---

## 5. Corrective Actions (CAPA — Corrective)

| Action | Status | Owner |
|--------|--------|-------|
| Add `Dockerfile.backend` building from **repo root** | ✅ Done | Dev |
| Set `ENV NODE_ENV=development` in Docker **builder** stage | ✅ Done | Dev |
| Remove `prepare` script from `shared/package.json` | ✅ Done | Dev |
| Use `npm ci --ignore-scripts` then explicit build steps | ✅ Done | Dev |
| Restore `backend/railway.toml` pointing to `Dockerfile.backend` | ✅ Done | Dev |
| Remove conflicting root `nixpacks.toml` | ✅ Done | Dev |
| Exclude `**/.env` from Docker context | ✅ Done | Dev |
| Add GitHub Actions workflow to verify Docker build on push | ✅ Done | Dev |
| Document Railway settings in `RAILWAY.md` | ✅ Done | Dev |

### Required Railway UI settings (manual — user must verify)

| Service | Root Directory | Builder |
|---------|----------------|---------|
| `@credpriv/backend` | **`/`** (empty / repo root) | **Dockerfile** → `Dockerfile.backend` |
| `@credpriv/frontend` | `frontend` | Nixpacks (default) |
| Postgres | (template) | Do not override PGDATA |

---

## 6. Preventive Actions (CAPA — Preventive)

| Action | Purpose |
|--------|---------|
| **GitHub Actions `docker-build.yml`** | Catch backend Docker failures before/at same time as Railway |
| **Single build path** | Dockerfile only for backend; no duplicate nixpacks.toml |
| **`npm run build:backend`** | One command for local + CI parity |
| **RAILWAY.md deployment checklist** | Standardize Root Directory, env vars, domain setup |
| **Never use placeholder URLs in browser** | Use generated Railway domains only |
| **Recreate Postgres from template** if PGDATA errors | Avoid manual PGDATA overrides |

### Recommended next steps

1. Confirm Railway backend **Root Directory = `/`**
2. Confirm builder = **Dockerfile** (`Dockerfile.backend`)
3. Redeploy backend from latest `main`
4. Generate public domain → test `/health`
5. Set real `CORS_ORIGIN` + `NEXT_PUBLIC_API_URL`
6. Run `npx tsx prisma/seed.ts` once in backend shell

---

## 7. Verification Plan

| Check | Expected Result | Method |
|-------|-----------------|--------|
| GitHub Actions | Green `Verify Backend Docker Build` | github.com/docsamraj/credpriv-one/actions |
| Local Docker | `docker build -f Dockerfile.backend .` succeeds | Dev machine |
| Railway build | All builder steps pass (npm ci → shared build → prisma → tsc) | Build logs |
| Railway deploy | Service Active | Dashboard |
| Health endpoint | `{"status":"ok",...}` | `GET /health` |
| Login | JWT returned | `POST /api/auth/login` |
| Frontend | Login page reaches backend API | Browser |

---

## 8. Current Known-Good Build (verified locally)

```bash
docker build -f Dockerfile.backend -t credpriv-backend .
# Result: SUCCESS (2026-07-03)
```

Docker build steps:
1. `COPY . .`
2. `ENV NODE_ENV=development`
3. `npm ci --ignore-scripts`
4. `npm run build --workspace=@credpriv/shared`
5. `npm run db:generate --workspace=@credpriv/backend`
6. `npm run build --workspace=@credpriv/backend`

---

## 9. Sign-off Checklist

- [ ] Railway backend Root Directory = `/`
- [ ] Railway backend uses Dockerfile.backend
- [ ] Postgres Online (no PGDATA errors)
- [ ] DATABASE_URL referenced on backend
- [ ] JWT_SECRET set on backend
- [ ] Public domains generated for backend + frontend
- [ ] CORS_ORIGIN and NEXT_PUBLIC_API_URL use real URLs
- [ ] GitHub Actions docker-build workflow green
- [ ] `/health` returns 200
- [ ] Demo login works

---

*This document should be updated after the next successful Railway production deploy.*
