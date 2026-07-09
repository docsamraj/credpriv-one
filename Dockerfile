# Frontend image — Railway Root Directory = /, dockerfilePath = Dockerfile
# Backend service uses Dockerfile.backend (separate Railway service).
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared ./shared
COPY frontend ./frontend

RUN npm ci --ignore-scripts
RUN npm run build --workspace=@credpriv/shared

WORKDIR /app/frontend

ARG RAILWAY_GIT_COMMIT_SHA=local
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BUILD_SHA=$RAILWAY_GIT_COMMIT_SHA
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NODE_OPTIONS=--max-old-space-size=4096

# Inline NODE_ENV so Railway service variables cannot override with "development"
RUN rm -rf .next && NODE_ENV=production npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
