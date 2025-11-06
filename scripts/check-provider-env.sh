#!/bin/bash

# Script to check provider API credentials for cost reconciliation

echo "🔍 Checking Provider API Credentials..."
echo ""

check_env() {
  local var_name=$1
  local display_name=${2:-$var_name}

  if [ -n "${!var_name}" ]; then
    local length=${#!var_name}
    echo "✅ $display_name is set (length: $length)"
  else
    echo "❌ $display_name is NOT set"
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "NEON POSTGRES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_env "NEON_API_KEY"
check_env "NEON_PROJECT_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VERCEL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_env "VERCEL_API_TOKEN"
check_env "VERCEL_PROJECT_ID"
check_env "VERCEL_TEAM_ID" "VERCEL_TEAM_ID (optional)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FLY.IO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_env "FLY_API_TOKEN"
check_env "FLY_APP_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CRON AUTHORIZATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_env "CRON_SECRET"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To test the reconciliation endpoint:"
echo ""
echo "1. Start your dev server:"
echo "   pnpm dev"
echo ""
echo "2. In another terminal, run:"
echo "   curl -H \"Authorization: Bearer \$CRON_SECRET\" \\"
echo "        http://localhost:3000/api/cron/reconcile-vendor"
echo ""
echo "3. Check the dev server console for detailed logs"
echo ""
