# RCA & CAPA — Frontend Railway Healthcheck Failure

**Document ID:** RCA-CAPA-2026-003  
**Date:** 2026-07-10  
**Scope:** Production frontend (`credpriv-production.up.railway.app`) — `@credpriv/frontend`  
**Status:** Root cause confirmed; corrective actions implemented / pending verify on Railway

---

## 1. Problem Statement

Railway deployments for `@credpriv/frontend` repeatedly failed after the image **built and deployed**, with:

- **Network → Healthcheck failure**
- Deploy logs: `Attempt #N failed with service unavailable`
- Final: `1/1 replicas never became healthy!` / `Healthcheck failed!`

Observed on commits including `2db8642` (“Force NODE_ENV=production…”) and related deploys. Build phase succeeded; failure was at **runtime healthcheck**, not compile.

---

## 2. Evidence

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Docker `next build` (local, fixed Dockerfile) | Exit 0 | Exit 0 | PASS |
| Image CMD `node server.js` from `/app` (pre-fix) | Server starts | `Cannot find module '/app/server.js'` | **FAIL** |
| `server.js` location in standalone image | `/app/server.js` (assumed) | `/app/frontend/server.js` | **Mismatch** |
| Static assets copy target (pre-fix) | Next to `server.js` | `/app/.next/static` (wrong nest) | **FAIL** |
| Healthcheck path `/login` (local, post-fix) | HTTP 200 | HTTP 200 | PASS |
| Railway Build step | Success | Success (screenshots) | PASS |
| Railway Deploy step | Success | Success (container scheduled) | PASS |
| Railway Healthcheck | Healthy | Service unavailable ×6 | **FAIL** |

**Conclusion:** The container process crashed (or never bound a port) before Railway could reach `/login`. Healthcheck failure is a **symptom**, not the root cause.

---

## 3. Timeline of related failures (same incident chain)

| Phase | Symptom | Underlying cause |
|-------|---------|------------------|
| A | `next build` fails in Docker | `NODE_ENV=development` during build → broken `/404` prerender |
| B | Build fails / shared missing | Root Directory `frontend` or Dockerfile skipped `@credpriv/shared` |
| C | Build OK, healthcheck fails | Standalone `server.js` under `/app/frontend`; start command looked in `/app` |

Phases A–B were fixed in commits through `2db8642`. Phase C is this RCA (fix in `338b705` + follow-up hardening).

---

## 4. Root Cause Analysis (5 Whys)

### Failure — Healthcheck / service unavailable

```
Why did the healthcheck fail?
→ Railway could not get a successful HTTP response from the replica (service unavailable).

Why was the service unavailable?
→ The Node process exited immediately (or never listened on the assigned PORT).

Why did the process exit?
→ `node server.js` could not resolve the entry file:
   Error: Cannot find module '/app/server.js'

Why was server.js not at /app/server.js?
→ Next.js `output: 'standalone'` with monorepo `outputFileTracingRoot` (repo root)
   nests the standalone server at `.next/standalone/frontend/server.js`.
   The runner copied standalone to `/app`, so the real entry is `/app/frontend/server.js`.

Why wasn't this caught before production?
→ Local `npm run build` / `next start` does not use the standalone layout.
   Docker builds were verified for compile success, not always for `docker run` + curl /login.
   Railway startCommand (`node server.js`) was assumed to run under Dockerfile WORKDIR;
   if the platform starts from `/app` (or overrides WORKDIR), the wrong path is used.
```

### Contributing factors

| # | Factor | Impact |
|---|--------|--------|
| C1 | Monorepo + `outputFileTracingRoot: '..'` | Standalone layout differs from single-package Next apps |
| C2 | Multiple Dockerfiles (`Dockerfile`, `Dockerfile.frontend`, `frontend/Dockerfile`) | Easy to fix one path and leave another stale |
| C3 | `railway-frontend.toml` `startCommand` separate from Dockerfile `CMD` | Path/WORKDIR mismatch between image and Railway override |
| C4 | Healthcheck on `/login` with short retries | Correctly detects crash, but error message looks like “network” not “missing module” |
| C5 | Railway Agent diagnosis quota exhausted | Slower triage; relied on truncated Build Logs UI |
| C6 | Confusing Build Logs tab showing Deploy/healthcheck lines | Easy to mis-attribute as build failure |

---

## 5. Root Causes (summary)

| ID | Root cause | Category |
|----|------------|----------|
| **RC-1** | **Standalone entrypoint is `/app/frontend/server.js`, but process was started as `node server.js` from `/app` (or equivalent)** | Deployment / packaging |
| **RC-2** | **Static/public assets were copied to `/app/.next/static` and `/app/public` instead of under `/app/frontend/`** | Packaging |
| **RC-3** | **No mandatory post-image smoke: `docker run` + HTTP check on healthcheck path before declaring deploy ready** | Process / CI |
| **RC-4** | **Fragmented Railway/Docker config increased chance of wrong start path** | Configuration |

---

## 6. Corrective Actions (CA) — immediate

| ID | Action | Owner | Status |
|----|--------|-------|--------|
| **CA-1** | Set runner `WORKDIR /app/frontend`; copy static → `./frontend/.next/static`, public → `./frontend/public` | Eng | **Done** (`338b705`) |
| **CA-2** | Use absolute start command so Railway WORKDIR override cannot break start: `node /app/frontend/server.js` | Eng | **This CAPA** |
| **CA-3** | Align `Dockerfile`, `Dockerfile.frontend`, and `frontend/Dockerfile` to the same runner layout | Eng | **Done** / keep in sync |
| **CA-4** | Increase `healthcheckTimeout` to 300s (cold start buffer) | Eng | **Done** (`railway-frontend.toml`) |
| **CA-5** | Redeploy frontend on Railway from commit containing CA-1/CA-2; confirm Deploy Logs show `Ready` and `/login` 200 | Ops | **Pending verify** |
| **CA-6** | On backend shell (separate): `npx prisma migrate deploy && npx tsx prisma/seed.ts` only if demo data needed — **not** related to this healthcheck | Ops | Optional |

### Verification checklist (post-redeploy)

1. Deploy commit ≥ `338b705` (and CA-2 commit if newer).
2. **Deploy Logs** (not only Build Logs): `✓ Ready` / listening on `0.0.0.0`.
3. Healthcheck step green.
4. Browser: `https://credpriv-production.up.railway.app/login` loads.
5. Optional: staff page shows `build <sha>` if `NEXT_PUBLIC_BUILD_SHA` is set.

---

## 7. Preventive Actions (PA) — systemic

| ID | Action | Rationale |
|----|---------|-----------|
| **PA-1** | Add CI job: `docker build -f Dockerfile` then `docker run` + `curl -f http://localhost:3000/login` | Catches RC-1 before Railway |
| **PA-2** | Prefer Dockerfile `CMD` only; if Railway `startCommand` is required, always use **absolute** path to `server.js` | Prevents WORKDIR drift |
| **PA-3** | Single source of truth: document in `RAILWAY.md` — Root `/`, dockerfile `Dockerfile`, start `/app/frontend/server.js`, health `/login` | Reduces config sprawl |
| **PA-4** | Smoke script already exists (`scripts/smoke-test.sh`); run against production after every frontend deploy | Detects stale/broken UI early (see RCA-002) |
| **PA-5** | When healthcheck fails, **always open Deploy Logs first** for `Cannot find module` / crash stack | Faster RCA next time |
| **PA-6** | Avoid setting Railway `NODE_ENV=development` on frontend service | Prevents Phase A build regressions |

---

## 8. What this was *not*

| Suspected | Why ruled out |
|-----------|----------------|
| Prisma migrate / seed on frontend | Frontend has no Prisma; healthcheck is HTTP to Next server |
| Backend down | Frontend healthcheck hits `/login` on the frontend service itself |
| Missing `BACKEND_URL` at runtime | Would not prevent Next from binding `/login` (rewrites fail later on API calls) |
| Pure “network” outage | Replicas never became healthy = process/listen failure pattern |

---

## 9. Railway settings (required)

| Setting | Value |
|---------|-------|
| Root Directory | `/` (blank — **not** `frontend`) |
| Config-as-code | `railway-frontend.toml` |
| Dockerfile path | `Dockerfile` |
| Healthcheck path | `/login` |
| `NODE_ENV` variable | `production` or **unset** (never `development`) |

---

## 10. Sign-off

| Role | Name | Date |
|------|------|------|
| Author | Cursor agent (CredPriv One) | 2026-07-10 |
| Verified on Railway | _pending redeploy_ | |

**Related:** RCA-CAPA-2026-002 (stale frontend bundles / button stubs).
