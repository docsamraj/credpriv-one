#!/bin/sh
set -e

echo "=== CredPriv One Backend Startup ==="
echo "NODE_ENV=${NODE_ENV:-unset}"
echo "PORT=${PORT:-4000}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Link Postgres in Railway Variables."
  exit 1
fi

echo "Running database migrations..."
if npx prisma migrate deploy; then
  echo "Migrations applied successfully."
else
  echo "ERROR: prisma migrate deploy failed. Check DATABASE_URL and Postgres connectivity."
  exit 1
fi

echo "Starting API server on 0.0.0.0:${PORT:-4000}..."
exec node dist/index.js
