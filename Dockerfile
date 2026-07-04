# Frontend image — Railway Root Directory = /, dockerfilePath = Dockerfile
# Backend service uses Dockerfile.backend (separate Railway service).
FROM node:20-bookworm-slim AS builder
WORKDIR /app

ENV NODE_ENV=development

COPY package.json package-lock.json ./
COPY frontend ./frontend
COPY shared ./shared
COPY backend/package.json ./backend/package.json

RUN npm ci --workspace=@credpriv/frontend --ignore-scripts

WORKDIR /app/frontend

ARG RAILWAY_GIT_COMMIT_SHA=local
ENV NEXT_PUBLIC_BUILD_SHA=$RAILWAY_GIT_COMMIT_SHA

RUN rm -rf .next && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend ./frontend

WORKDIR /app/frontend

EXPOSE 3000

CMD ["npm", "start"]
