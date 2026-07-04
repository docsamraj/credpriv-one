# Optional Docker build — use only when Root Directory = frontend/
# Preferred deploy: Nixpacks (see railway.toml)
FROM node:20-bookworm-slim AS builder
WORKDIR /app

ENV NODE_ENV=development

COPY package.json ./
RUN npm install

COPY . .

ARG RAILWAY_GIT_COMMIT_SHA=local
ARG CACHEBUST=1
ENV NEXT_PUBLIC_BUILD_SHA=$RAILWAY_GIT_COMMIT_SHA

RUN echo "cachebust=$CACHEBUST sha=$RAILWAY_GIT_COMMIT_SHA" && rm -rf .next && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["npm", "start"]
