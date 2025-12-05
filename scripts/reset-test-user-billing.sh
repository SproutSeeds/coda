#!/usr/bin/env bash
set -euo pipefail

# Reset a test user's billing state locally and in Stripe test mode.
# Usage:
#   ./scripts/reset-test-user-billing.sh
#
# This script will prompt for email and will:
#   - Cancel their Stripe subscription (if any, gracefully handles already-canceled)
#   - Delete the Stripe customer (if any, gracefully handles already-deleted)
#   - Clear auth_user billing fields (plan_id, stripe_customer_id, stripe_subscription_id, subscription_period_end)
#   - Reset wallet (mana_balance, booster_balance, last_core_grant_at)
#   - Reset progression (is_channeling, channeling_expires_at)
#   - Clear mana potions inventory
#   - Delete all refund request history
#   - Delete all gifts (sent/received)
#   - Delete all referrals (where user is inviter)
#   - Delete all quest progress
#
# Requires:
#   - npx tsx available

# Load from .env.local if it exists
if [[ -f .env.local ]]; then
  source .env.local 2>/dev/null || true
fi

read -rp "Email to reset: " EMAIL
read -rp "Stripe test secret key [press Enter to use STRIPE_SECRET_KEY from env]: " INPUT_STRIPE_KEY
read -rp "DATABASE_URL [press Enter to use DATABASE_URL from env]: " INPUT_DATABASE_URL

if [[ -n "$INPUT_DATABASE_URL" ]]; then
  DATABASE_URL="$INPUT_DATABASE_URL"
fi
if [[ -n "$INPUT_STRIPE_KEY" ]]; then
  STRIPE_SECRET_KEY="$INPUT_STRIPE_KEY"
fi

if [[ -z "$EMAIL" || -z "$STRIPE_SECRET_KEY" || -z "$DATABASE_URL" ]]; then
  echo "Missing required input. Exiting." >&2
  exit 1
fi

echo ""
echo "Resetting billing for: $EMAIL"

USER_EMAIL="$EMAIL" STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" DATABASE_URL="$DATABASE_URL" \
  npx tsx scripts/reset-test-user-billing.ts
