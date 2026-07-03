# CredPriv One

Hospital-grade web application for end-to-end **Provider Lifecycle Management** — credentialing, privileging, committee governance, and analytics. Built for cardiac and multi-specialty hospitals with accreditation-friendly audit trails and role-based access control.

## Overview

CredPriv One is a single platform where:

- **Providers** onboard, upload credentials, and request clinical privileges
- **Credentialing staff** verify documents and track primary source verification (PSV)
- **Committees** (Credentialing, MEC, Board) review cases and record decisions
- **Leadership** monitors turnaround times, expiring credentials, and bottlenecks

AI-assisted workflows help flag missing documents, expiries, and inconsistencies — but **humans make all final decisions**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Auth** | JWT + RBAC |
| **Shared Types** | `@credpriv/shared` workspace package |

## Project Structure

```
credpriv-one/
├── backend/                 # Express API server
│   ├── prisma/
│   │   ├── schema.prisma  # Database schema (all entities)
│   │   └── seed.ts        # Demo data seeder
│   └── src/
│       ├── index.ts       # Server entry + /health route
│       ├── middleware/    # auth, rbac, audit
│       ├── routes/        # REST API endpoints
│       ├── services/      # Business logic
│       └── modules/ai/    # Modular AI helpers (OCR, case summary)
├── frontend/              # Next.js React app
│   └── src/
│       ├── app/           # Pages (provider, staff, committee, admin, analytics)
│       ├── components/    # Reusable UI components
│       └── lib/           # API client, auth helpers
├── shared/                # Shared TypeScript types & enums
├── package.json           # Monorepo root (npm workspaces)
└── README.md
```

## Architecture

```
┌─────────────┐     REST/JSON      ┌─────────────┐     Prisma      ┌────────────┐
│  Next.js    │ ◄───────────────► │  Express    │ ◄─────────────► │ PostgreSQL │
│  Frontend   │                    │  Backend    │                 │            │
└─────────────┘                    └──────┬──────┘                 └────────────┘
                                          │
                                   ┌──────▼──────┐
                                   │  AI Module  │  (OCR, case summary, flags)
                                   │  (modular)  │
                                   └─────────────┘
```

### Key Entities

`User` · `Role` · `Provider` · `ProviderProfile` · `Application` · `Credential` · `Document` · `VerificationRequest` · `Privilege` · `PrivilegeCategory` · `Procedure` · `Committee` · `CommitteeMember` · `CommitteeMeeting` · `CommitteeReview` · `CommitteeDecision` · `MonitoringEvent` · `Task` · `Notification` · `Department` · `Specialty` · `AuditLog`

### Application Lifecycle

```
Draft → Submitted → Under Verification → Committee → MEC → Board → Approved / Denied
```

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+ (local or cloud)
- **npm** 9+

## Local Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd credpriv-one
npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/credpriv?schema=public"
PORT=4000
JWT_SECRET=your-long-random-secret-here
CORS_ORIGIN=http://localhost:3000
```

### 3. Start PostgreSQL (Docker)

```bash
npm run db:up
```

This starts PostgreSQL on `localhost:5432` via Docker Compose. If you already have PostgreSQL running locally, skip this step and ensure `DATABASE_URL` in `backend/.env` matches your instance.

### 4. Database setup

```bash
npm run db:generate
npm run db:push    # first-time local setup (or db:migrate for migration history)
npm run db:seed
```

### 5. Run development servers

```bash
# Both backend + frontend concurrently
npm run dev

# Or separately:
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:3000
```

### 6. Verify

- Health check: http://localhost:4000/health
- Login: http://localhost:3000/login

### Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| provider@credpriv.hospital | Provider | Password123! |
| staff@credpriv.hospital | Credentialing Staff | Password123! |
| committee@credpriv.hospital | Committee Member | Password123! |
| admin@credpriv.hospital | System Admin | Password123! |

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user profile |

### Providers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers` | List providers (paginated) |
| GET | `/api/providers/:id` | Provider detail + credentials |
| PATCH | `/api/providers/:id/profile` | Update profile |

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/applications` | List applications |
| GET | `/api/applications/queues` | Staff workflow queues |
| POST | `/api/applications` | Create application |
| POST | `/api/applications/:id/submit` | Submit application |
| POST | `/api/applications/:id/committee-ready` | Mark committee-ready |

### Credentials & PSV
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/credentials/provider/:id` | Provider credentials |
| POST | `/api/credentials` | Add credential |
| GET | `/api/credentials/expiring/:days` | Expiring credentials |
| GET | `/api/credentials/verifications/pending` | Pending PSV queue |
| PATCH | `/api/credentials/verifications/:id` | Complete PSV |

### Committees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/committees` | List committees |
| GET | `/api/committees/meetings` | Upcoming meetings |
| GET | `/api/committees/reviews/:id` | Review packet |
| POST | `/api/committees/reviews/:id/decisions` | Record decision |
| GET | `/api/committees/ai-summary/:providerId` | AI case summary |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | Executive KPIs |
| GET | `/api/analytics/turnaround` | Turnaround by stage |
| GET | `/api/analytics/trends` | Monthly trends |
| GET | `/api/analytics/bottlenecks` | Bottleneck analysis |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/departments` | Manage departments |
| GET | `/api/admin/specialties` | List specialties |
| GET | `/api/admin/workflow-stages` | Workflow config |
| GET | `/api/admin/audit-logs` | Audit trail |

## Deployment to Railway

### Backend Service

1. **Connect GitHub repo** to Railway (https://railway.app)
2. **Create a new service** from the repo, set root directory to `backend`
3. **Add PostgreSQL** plugin — Railway auto-sets `DATABASE_URL`
4. **Set environment variables:**
   ```
   PORT=4000
   JWT_SECRET=<generate-a-strong-secret>
   CORS_ORIGIN=https://your-frontend-url.railway.app
   NODE_ENV=production
   ```
5. **Set build & start commands:**
   - Build: `npm install && npx prisma generate && npm run build`
   - Start: `npx prisma migrate deploy && npm start`
6. **Deploy** and verify: `https://your-api.railway.app/health`

### Frontend Service

1. Create a second Railway service from the same repo
2. Set root directory to `frontend`
3. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.railway.app
   ```
4. Build: `npm install && npm run build`
5. Start: `npm start`

### Alternative: Single Repo Deploy

Use the root `package.json` workspaces and deploy backend first, then frontend with the API URL pointing to the backend service.

## RBAC Roles

| Role | Access |
|------|--------|
| PROVIDER | Own applications, documents, profile |
| CREDENTIALING_STAFF | Verification queues, PSV, mark committee-ready |
| COMMITTEE_MEMBER | Review packets, record decisions |
| MEC_MEMBER | MEC-level reviews and decisions |
| DEPARTMENT_CHAIR | Department-level reviews |
| ADMINISTRATOR | Analytics, read-all |
| QUALITY_ACCREDITATION | Analytics, audit logs, monitoring |
| SYSTEM_ADMIN | Full admin configuration |

## Future Improvements

- **OPPE/FPPE Module** — Structured metrics, proctoring workflows, performance dashboards
- **Incident Linkage** — Restrict/modify privileges after adverse events
- **Multi-Tenant** — Multiple hospitals in one instance (`Hospital`/`Tenant` model)
- **Integrations** — HIS/EMR/HRIS via webhook API and HL7 FHIR
- **Advanced AI** — Predictive risk scoring, document classification, NLP over policies
- **Real OCR** — Tesseract, AWS Textract, or Google Vision integration
- **LLM Summaries** — OpenAI/Anthropic for committee case summaries
- **Notifications** — Email (SendGrid/SES), SMS (Twilio) delivery engine
- **Document Storage** — S3/Cloudflare R2 for production file uploads

## License

Proprietary — CredPriv One © 2026
