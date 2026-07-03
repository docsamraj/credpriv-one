# Frontend Docker build — Railway Root Directory = frontend/
FROM node:20-alpine AS builder
WORKDIR /app

ENV NODE_ENV=development

COPY package.json ./
RUN npm install

COPY . .

ARG RAILWAY_GIT_COMMIT_SHA=local
ENV NEXT_PUBLIC_BUILD_SHA=$RAILWAY_GIT_COMMIT_SHA

RUN rm -rf .next && npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["npm", "start"]
