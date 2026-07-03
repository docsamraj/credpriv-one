# Railway Deployment

## Backend (`@credpriv/backend`) — REQUIRED settings

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` (repo root — **NOT** `backend`) |
| **Config file** | `backend/railway.toml` (auto-detected) |
| **Builder** | Dockerfile (`Dockerfile.backend`) |

The backend depends on `@credpriv/shared`. Railway must see the full monorepo.
If Root Directory is `backend`, the build fails with `cd ../shared: No such file or directory`.

### Frontend variables

```env
NEXT_PUBLIC_API_URL=https://credprivbackend-production.up.railway.app
NODE_ENV=production
```

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
