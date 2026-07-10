# Railway Deployment

## Backend (`@credpriv/backend`) — REQUIRED settings

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` (repo root — **NOT** `backend`) |
| **Config file** | `backend/railway.toml` (auto-detected) |
| **Builder** | Dockerfile (`Dockerfile.backend`) |

The backend depends on `@credpriv/shared`. Railway must see the full monorepo.
If Root Directory is `backend`, the build fails with `cd ../shared: No such file or directory`.

### Frontend (`@credpriv/frontend`) — REQUIRED settings

| Setting | Value |
|---------|-------|
| **Root Directory** | **`/`** (repo root — leave blank or `/`; **NOT** `frontend`) |
| **Config-as-code** | `railway-frontend.toml` |
| **Dockerfile** | `Dockerfile` |
| **Start command** | `node /app/frontend/server.js` (absolute — monorepo standalone) |
| **Healthcheck** | `/login` |

The frontend imports `@credpriv/shared`. If Root Directory is `frontend`, the build fails because the shared package is missing.

**If build keeps failing:** open **Settings → General → Root Directory** and delete `frontend` so Railway uses the repo root.

**If healthcheck fails after a green build:** open **Deploy Logs** (not Build Logs). Look for `Cannot find module ... server.js`. See `RCA-CAPA-003-FRONTEND-HEALTHCHECK.md`.

### Frontend variables

```env
BACKEND_URL=https://credprivbackend-production.up.railway.app
NEXT_PUBLIC_API_URL=https://credprivbackend-production.up.railway.app
NODE_ENV=production
```

Or wire to the backend service in Railway (Settings → Variables → **Add Reference**):

```env
BACKEND_URL=https://${{credpriv-backend.RAILWAY_PUBLIC_DOMAIN}}
```

`BACKEND_URL` powers the Next.js `/api/*` proxy at **runtime** — the browser never calls the backend directly.

After changing variables or code: **Deploy → Redeploy** the frontend service, then hard-refresh (`Ctrl+Shift+R`).

Public URL: `https://credpriv-production.up.railway.app`

### Backend variables (Raw Editor)

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
JWT_SECRET=your-secret-here-min-16-chars
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://credpriv-production.up.railway.app
UPLOAD_DIR=./uploads
DOCUMENT_ENCRYPTION_KEY=generate-64-char-hex
PRIVACY_NOTICE_VERSION=2026-07-10
```

Set `DOCUMENT_ENCRYPTION_KEY` before uploading real Aadhaar/PAN documents. Generate with:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

On the **frontend**, do **not** set `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` in production (demo passwords stay hidden).

## After deploy

1. Generate public domains for both services (Settings → Networking)
2. Update `CORS_ORIGIN` and `NEXT_PUBLIC_API_URL` with real URLs
3. Redeploy both
4. Test: `https://YOUR-BACKEND-URL/health`
5. Seed (backend shell): `npx tsx prisma/seed.ts`
