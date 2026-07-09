# Monorepo frontend image — Railway must use Root Directory = / (repo root)
# Config: railway-frontend.toml or Settings → Dockerfile Path = Dockerfile.frontend
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared ./shared
COPY frontend ./frontend

RUN npm ci --ignore-scripts
RUN npm run build --workspace=@credpriv/shared

WORKDIR /app/frontend

ARG RAILWAY_GIT_COMMIT_SHA=local
ENV NEXT_PUBLIC_BUILD_SHA=$RAILWAY_GIT_COMMIT_SHA
ENV NODE_OPTIONS=--max-old-space-size=4096
ENV NODE_ENV=production

RUN rm -rf .next && npm run build

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
