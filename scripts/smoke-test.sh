#!/usr/bin/env bash
# CredPriv One smoke test — run against local or production
# Usage: ./scripts/smoke-test.sh [API_URL] [FRONTEND_URL]
# Example: ./scripts/smoke-test.sh http://localhost:4000 http://localhost:3000

set -euo pipefail

API_URL="${1:-http://localhost:4000}"
FRONTEND_URL="${2:-http://localhost:3000}"
PASS=0
FAIL=0
SKIP=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }
skip() { echo "  ○ $1 (skipped)"; SKIP=$((SKIP + 1)); }

echo "=============================================="
echo " CredPriv One Smoke Test"
echo " API:      $API_URL"
echo " Frontend: $FRONTEND_URL"
echo "=============================================="
echo ""

# --- Health ---
echo "[1] Health checks"
HEALTH=$(curl -sf "$API_URL/health" || echo "FAIL")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  pass "GET /health"
else
  fail "GET /health — $HEALTH"
fi

DB_HEALTH=$(curl -sf "$API_URL/health/db" || echo "FAIL")
if echo "$DB_HEALTH" | grep -q '"database":"connected"'; then
  pass "GET /health/db"
else
  fail "GET /health/db — $DB_HEALTH"
fi

# --- Auth ---
echo ""
echo "[2] Authentication"
LOGIN=$(curl -sf -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"provider@credpriv.hospital","password":"Password123!"}' || echo "FAIL")

if echo "$LOGIN" | grep -q '"success":true'; then
  pass "POST /api/auth/login (provider)"
  TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$TOKEN" ]; then
    TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  fi
else
  fail "POST /api/auth/login — $LOGIN"
  TOKEN=""
fi

if [ -n "$TOKEN" ]; then
  ME=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_URL/api/auth/me" || echo "FAIL")
  if echo "$ME" | grep -q 'PROVIDER'; then
    pass "GET /api/auth/me (provider role)"
  else
    fail "GET /api/auth/me — $ME"
  fi
else
  skip "GET /api/auth/me"
fi

# --- Applications ---
echo ""
echo "[3] Applications (provider)"
if [ -n "$TOKEN" ]; then
  APPS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_URL/api/applications" || echo "FAIL")
  if echo "$APPS" | grep -q '"success":true'; then
    pass "GET /api/applications"
  else
    fail "GET /api/applications — $APPS"
  fi

  CREATE=$(curl -sf -X POST "$API_URL/api/applications" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"type":"INITIAL_APPOINTMENT"}' || echo "FAIL")
  if echo "$CREATE" | grep -q '"success":true'; then
    pass "POST /api/applications"
    APP_ID=$(echo "$CREATE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  else
    fail "POST /api/applications — $CREATE"
    APP_ID=""
  fi
else
  skip "GET /api/applications"
  skip "POST /api/applications"
  APP_ID=""
fi

# --- Documents ---
echo ""
echo "[4] Documents (provider)"
if [ -n "$TOKEN" ]; then
  DOCS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_URL/api/documents/my" || echo "FAIL")
  if echo "$DOCS" | grep -q '"success":true'; then
    pass "GET /api/documents/my"
  else
    fail "GET /api/documents/my — $DOCS"
  fi
else
  skip "GET /api/documents/my"
fi

# --- Staff login ---
echo ""
echo "[5] Staff role"
STAFF_LOGIN=$(curl -sf -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@credpriv.hospital","password":"Password123!"}' || echo "FAIL")
if echo "$STAFF_LOGIN" | grep -q '"success":true'; then
  pass "POST /api/auth/login (staff)"
  STAFF_TOKEN=$(echo "$STAFF_LOGIN" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$STAFF_TOKEN" ]; then
    STAFF_TOKEN=$(echo "$STAFF_LOGIN" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  fi
  QUEUES=$(curl -sf -H "Authorization: Bearer $STAFF_TOKEN" "$API_URL/api/applications/queues" || echo "FAIL")
  if echo "$QUEUES" | grep -q '"success":true'; then
    pass "GET /api/applications/queues"
  else
    fail "GET /api/applications/queues — $QUEUES"
  fi
else
  fail "POST /api/auth/login (staff) — $STAFF_LOGIN"
fi

# --- Frontend ---
echo ""
echo "[6] Frontend"
LOGIN_PAGE=$(curl -sf -o /dev/null -w "%{http_code}" "$FRONTEND_URL/login" || echo "000")
if [ "$LOGIN_PAGE" = "200" ]; then
  pass "GET /login ($LOGIN_PAGE)"
else
  fail "GET /login (HTTP $LOGIN_PAGE)"
fi

PROVIDER_PAGE=$(curl -sf "$FRONTEND_URL/dashboard/provider" || echo "FAIL")
CHUNK=$(echo "$PROVIDER_PAGE" | grep -oE 'page-[a-f0-9]+\.js' | head -1)
if [ -n "$CHUNK" ]; then
  CHUNK_BODY=$(curl -sf "$FRONTEND_URL/_next/static/chunks/app/dashboard/provider/$CHUNK" || echo "")
  if echo "$CHUNK_BODY" | grep -q 'BOARD_CERT\|documents/my\|Application Details'; then
    pass "Provider dashboard JS wired ($CHUNK)"
  else
    fail "Provider dashboard JS is OLD stub ($CHUNK) — redeploy frontend"
  fi
else
  fail "Provider dashboard chunk not found"
fi

PROXY=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/applications")
if [ "$PROXY" = "401" ]; then
  pass "Frontend /api proxy → backend (401 unauthenticated)"
elif [ "$PROXY" = "000" ]; then
  fail "Frontend /api proxy unreachable"
else
  fail "Frontend /api proxy unexpected HTTP $PROXY (expected 401)"
fi

# --- Summary ---
echo ""
echo "=============================================="
echo " Results: $PASS passed, $FAIL failed, $SKIP skipped"
echo "=============================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
