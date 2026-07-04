# RCA & CAPA — Provider Dashboard Buttons Non-Functional (Production)

**Document ID:** RCA-CAPA-2026-002  
**Date:** 2026-07-04  
**Scope:** Production frontend (`credpriv-production.up.railway.app`) — all dashboard roles  
**Status:** Root cause confirmed; corrective actions below

---

## 1. Problem Statement

After multiple Railway deploys marked **Active** and **Build successful**, dashboard action buttons (View, Upload, New Application, Review, Mark Ready, admin tabs) remain **non-functional stubs** across provider, staff, committee, and admin roles. Left sidebar navigation (Next.js `<Link>`) works; right-side action buttons do not.

---

## 2. Evidence (2026-07-04 smoke test)

| Check | Expected (wired code) | Actual (production) | Result |
|-------|----------------------|---------------------|--------|
| Provider JS chunk | `page-4f402a46015f61fe.js` (~11.7 KB) | `page-b213bdf2688c7240.js` (~6.8 KB) | **FAIL** |
| Chunk contains `onClick` / `BOARD_CERT` | Yes | No | **FAIL** |
| `GET /health` backend | 200 | 200 | PASS |
| `POST /api/auth/login` | 200 | 200 | PASS |
| `POST /api/applications` | 201 | 201 | PASS |
| `GET /api/documents/my` | 200 | 200 | PASS |
| Frontend `/api` proxy | 401 | 401 | PASS |
| Build hash on dashboard | `build f3c0105` or newer | Not present | **FAIL** |

**Conclusion:** Backend and APIs are healthy. **Production is still serving a pre-wiring frontend build from ~2026-07-03.**

---

## 3. Root Cause Analysis (5 Whys)

### Failure E — Stale frontend client bundle in production

```
Why do right-side buttons not respond?
→ React onClick handlers are missing from the deployed JavaScript bundle.

Why are handlers missing?
→ Production serves chunk page-b213bdf2688c7240.js (stub UI from first scaffold).

Why wasn't the new bundle deployed?
→ Railway reports "Active" and Docker image push succeeded, but the running
  container still embeds the OLD .next build output in HTML.

Why did deploy appear successful while serving old code?
→ (1) Docker BuildKit layer cache reused an old `npm run build` layer from
    before commit 79f0190; and/or
    (2) Docker build from repo root with /frontend/Dockerfile failed silently
    on some attempts (Next.js 404 prerender error) and Railway kept the
    previous deployment; and/or
    (3) Root Directory / Dockerfile path mismatch caused wrong build context.

Why wasn't this caught earlier?
→ No CI pipeline validates frontend build output; smoke test script was
  added late; Deploy Logs (container start) were checked instead of
  Build Logs + production JS hash verification.
```

### Contributing factors

| # | Factor | Impact |
|---|--------|--------|
| C1 | Sidebar uses `<Link>` (works without JS); main buttons need client JS | Misleading "partially works" signal |
| C2 | `_next/static/*` cached `immutable` for 1 year | Browser/CDN holds old chunks if filename unchanged |
| C3 | Multiple conflicting deploy configs (root `railway.toml`, `frontend/railway.toml`, Nixpacks, Docker) | Wrong builder/context selected |
| C4 | Docker `COPY frontend/` when Root Directory is also `frontend` | Double-path / wrong context |
| C5 | Staff/committee buttons were stubs in early commits; only provider wired in 79f0190 | Even successful deploy of old commit = stubs |
| C6 | Unpushed local fixes (staff wiring, Nixpacks switch) | GitHub build may not match local |

---

## 4. Root Causes (summary)

| ID | Root cause | Category |
|----|------------|----------|
| **RC-1** | **Production frontend never served a post-79f0190 client bundle** | Deployment |
| **RC-2** | **No automated verification that built JS contains interactive handlers** | Process / CI |
| **RC-3** | **Docker layer cache + fragile multi-path Dockerfile setup** | Infrastructure |
| **RC-4** | **Deploy Logs (runtime) mistaken for Build Logs (compile)** | Human / process |

---

## 5. Corrective Actions (CAPA — Corrective)

| ID | Action | Owner | Status |
|----|--------|-------|--------|
| CA-1 | Switch `@credpriv/frontend` to **Nixpacks**, Root Directory **`frontend`**, remove Dockerfile builder | User / DevOps | **Required now** |
| CA-2 | Railway → Redeploy → **Clear build cache** | User | **Required now** |
| CA-3 | Add GitHub Actions job: build frontend + assert JS chunk contains `BOARD_CERT` | Dev | Done in this PR |
| CA-4 | Push all pending frontend fixes to `main` | Dev | Pending |
| CA-5 | After deploy: run `npm run smoke:prod` — must show 12/12 pass | User | After CA-1–4 |
| CA-6 | Hard-refresh browser (`Ctrl+Shift+R`); verify **build hash** on dashboard | User | After CA-5 |

### Railway settings (frontend) — final correct config

```
Root Directory:     frontend
Builder:            Nixpacks (NOT Dockerfile)
BACKEND_URL:        https://credprivbackend-production.up.railway.app
NEXT_PUBLIC_API_URL: https://credprivbackend-production.up.railway.app
```

Then: **Deploy** with **clear cache**.

---

## 6. Preventive Actions (CAPA — Preventive)

| ID | Action |
|----|--------|
| PA-1 | CI fails PR/push if frontend build JS lacks `documents/my` or `BOARD_CERT` |
| PA-2 | `npm run smoke:prod` documented in README; run after every frontend deploy |
| PA-3 | Dashboard shows `build {git-sha}` — visible deploy verification |
| PA-4 | Single source of truth: `frontend/railway.toml` (Nixpacks only); remove Docker frontend from default path |
| PA-5 | RCA-CAPA doc updated when deploy architecture changes |

---

## 7. Verification checklist (definition of done)

- [ ] `curl` production provider page → chunk hash **≠** `page-b213bdf2688c7240.js`
- [ ] Production chunk size **> 10 KB**
- [ ] Dashboard shows `build xxxxxxx`
- [ ] **View** opens modal (provider)
- [ ] **New Application** creates row
- [ ] **Upload** opens file picker
- [ ] Staff **Review** / **Mark Ready** work
- [ ] `npm run smoke:prod` → 12/12 pass

---

## 8. What was NOT the root cause

- Backend API failures (APIs work; data loads in UI)
- CORS (login and data fetch work)
- RBAC permissions (API calls succeed with demo users)
- Postgres / P3005 migration (separate issue; DB connected with 4 users)
- Missing `BACKEND_URL` alone (proxy returns 401 correctly)

---

*Next step: apply CA-1 through CA-4, then verify section 7.*
