# Railway Deployment

## Backend (`@credpriv/backend`) — REQUIRED settings

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` (repo root — **NOT** `backend`) |
| **Builder** | Dockerfile (`Dockerfile.backend`) |

The backend depends on `@credpriv/shared`. Railway must see the full monorepo.
If Root Directory is `backend`, the build fails with `cd ../shared: No such file or directory`.

### Backend variables (Raw Editor)

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://YOUR-FRONTEND-URL.up.railway.app
UPLOAD_DIR=./uploads
```

## Frontend (`@credpriv/frontend`)

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |

### Frontend variables

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-URL.up.railway.app
NODE_ENV=production
```

## After deploy

1. Generate public domains for both services (Settings → Networking)
2. Update `CORS_ORIGIN` and `NEXT_PUBLIC_API_URL` with real URLs
3. Redeploy both
4. Test: `https://YOUR-BACKEND-URL/health`
5. Seed (backend shell): `npx tsx prisma/seed.ts`
