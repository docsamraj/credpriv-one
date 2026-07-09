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
| **Root Directory** | `/` (repo root — **NOT** `frontend`) |
| **Config file** | `railway-frontend.toml` |
| **Dockerfile** | `Dockerfile.frontend` |

The frontend imports `@credpriv/shared`. If Root Directory is `frontend` only, the Docker build fails because the shared package is not in the build context.

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
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://credpriv-production.up.railway.app
UPLOAD_DIR=./uploads
```

## After deploy

1. Generate public domains for both services (Settings → Networking)
2. Update `CORS_ORIGIN` and `NEXT_PUBLIC_API_URL` with real URLs
3. Redeploy both
4. Test: `https://YOUR-BACKEND-URL/health`
5. Seed (backend shell): `npx tsx prisma/seed.ts`
