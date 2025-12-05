/**
 * Reset a test user's billing state locally and in Stripe test mode.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reset-test-user-billing.ts
 *
 * Defaults:
 *  - Email: codyshanemitchell@gmail.com
 *  - Uses STRIPE_SECRET_KEY and DATABASE_URL from .env.local
 *
 * Override with environment variables if needed:
 *   USER_EMAIL=other@email.com npx tsx --env-file=.env.local scripts/reset-test-user-billing.ts
 *
 * What it does:
 *  - Looks up the user by USER_ID or USER_EMAIL
 *  - Cancels the Stripe subscription (if any, gracefully handles already-canceled)
 *  - Deletes the Stripe customer (if any, gracefully handles already-deleted)
 *  - Clears plan/stripe fields on auth_user
 *  - Zeroes wallet (mana_balance, booster_balance)
 *  - Resets progression (is_channeling, channeling_expires_at)
 *  - Clears mana potions inventory
 *  - Deletes all refund request history for the user
 *  - Deletes all gifts sent by/to the user
 *  - Deletes all referrals where user is inviter
 *  - Deletes all quest progress for the user
 */

import postgres from "postgres";

// Hardcoded defaults - override with environment variables if needed
const DEFAULT_USER_EMAIL = "codyshanemitchell@gmail.com";

const userId = process.env.USER_ID;
const userEmail = process.env.USER_EMAIL || DEFAULT_USER_EMAIL;
const stripeKeyEnv = process.env.STRIPE_SECRET_KEY;
const databaseUrlEnv = process.env.DATABASE_URL;

if (!stripeKeyEnv) {
  console.error("STRIPE_SECRET_KEY is required. Run with: npx tsx --env-file=.env.local scripts/reset-test-user-billing.ts");
  process.exit(1);
}
if (!databaseUrlEnv) {
  console.error("DATABASE_URL is required. Run with: npx tsx --env-file=.env.local scripts/reset-test-user-billing.ts");
  process.exit(1);
}

const stripeKey = stripeKeyEnv as string;
const databaseUrl = databaseUrlEnv as string;

async function main() {
  const sql: any = postgres(databaseUrl, { ssl: "require" });

  // Look up user by ID or email
  let user: {
    id: string;
    email: string | null;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
  } | undefined;

  if (userId) {
    const [found] = (await sql`
      select id, email, stripe_subscription_id, stripe_customer_id
      from auth_user
      where id = ${userId}
      limit 1;
    `) ?? [];
    user = found;
  } else if (userEmail) {
    const [found] = (await sql`
      select id, email, stripe_subscription_id, stripe_customer_id
      from auth_user
      where email = ${userEmail}
      limit 1;
    `) ?? [];
    user = found;
  }

  if (!user) {
    console.error(`User not found (ID: ${userId}, Email: ${userEmail})`);
    process.exit(1);
  }

  const targetUserId = user.id;
  console.log(`\nResetting billing for user: ${user.email || targetUserId}`);
  console.log(`User ID: ${targetUserId}`);
  console.log("---");

  // Cancel subscription if present (gracefully handle already-canceled)
  if (user.stripe_subscription_id) {
    try {
      await stripeCall(`/v1/subscriptions/${encodeURIComponent(user.stripe_subscription_id)}`, "DELETE");
      console.log(`✓ Canceled Stripe subscription ${user.stripe_subscription_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("resource_missing") || message.includes("No such subscription")) {
        console.log(`⚠ Stripe subscription ${user.stripe_subscription_id} already canceled/deleted`);
      } else {
        throw err;
      }
    }
  } else {
    console.log("- No Stripe subscription to cancel");
  }

  // Delete customer if present (gracefully handle already-deleted)
  if (user.stripe_customer_id) {
    try {
      await stripeCall(`/v1/customers/${encodeURIComponent(user.stripe_customer_id)}`, "DELETE");
      console.log(`✓ Deleted Stripe customer ${user.stripe_customer_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("resource_missing") || message.includes("No such customer")) {
        console.log(`⚠ Stripe customer ${user.stripe_customer_id} already deleted`);
      } else {
        throw err;
      }
    }
  } else {
    console.log("- No Stripe customer to delete");
  }

  // Reset local billing state
  console.log("\nResetting local database state...");
  await sql.begin(async (tx: any) => {
    // auth_user - clear billing fields
    await tx`
      update auth_user
      set
        plan_id = null,
        stripe_customer_id = null,
        stripe_subscription_id = null,
        subscription_period_end = null
      where id = ${targetUserId};
    `;
    console.log("✓ Cleared auth_user billing fields");

    // wallets - reset balances
    await tx`
      update wallets
      set
        mana_balance = 0,
        booster_balance = 0,
        last_core_grant_at = null
      where user_id = ${targetUserId};
    `;
    console.log("✓ Reset wallet balances");

    // progression - reset channeling and quest hub visit
    await tx`
      update progression
      set
        is_channeling = false,
        channeling_expires_at = null,
        quest_hub_last_visit = null
      where user_id = ${targetUserId};
    `;
    console.log("✓ Reset progression (channeling, quest hub visit)");

    // mana_potions - reset inventory
    await tx`
      update mana_potions
      set
        small_potions = 0,
        medium_potions = 0,
        large_potions = 0
      where user_id = ${targetUserId};
    `;
    console.log("✓ Reset mana potions inventory");

    // refund_requests - delete history
    const refundResult = await tx`
      delete from refund_requests
      where user_id = ${targetUserId}
      returning id;
    `;
    console.log(`✓ Deleted ${refundResult.length} refund request(s)`);

    // gifts - delete sent/received gifts
    const giftResult = await tx`
      delete from gifts
      where sender_id = ${targetUserId} or recipient_id = ${targetUserId}
      returning id;
    `;
    console.log(`✓ Deleted ${giftResult.length} gift(s)`);

    // referrals - delete where user is inviter (keep where they are invitee to preserve who invited them)
    const referralResult = await tx`
      delete from referrals
      where inviter_id = ${targetUserId}
      returning id;
    `;
    console.log(`✓ Deleted ${referralResult.length} referral(s) (as inviter)`);

    // user_quests - delete quest progress (legacy)
    const questResult = await tx`
      delete from user_quests
      where user_id = ${targetUserId}
      returning id;
    `;
    console.log(`✓ Deleted ${questResult.length} quest progress record(s)`);

    // journey_task_completions - delete task completion records
    const taskCompletionsResult = await tx`
      delete from journey_task_completions
      where user_id = ${targetUserId}
      returning id;
    `;
    console.log(`✓ Deleted ${taskCompletionsResult.length} journey task completion(s)`);

    // journey_stage_completions - delete stage completion records
    const stageCompletionsResult = await tx`
      delete from journey_stage_completions
      where user_id = ${targetUserId}
      returning id;
    `;
    console.log(`✓ Deleted ${stageCompletionsResult.length} journey stage completion(s)`);

    // journey_progress - delete journey progress
    const journeyResult = await tx`
      delete from journey_progress
      where user_id = ${targetUserId}
      returning id;
    `;
    console.log(`✓ Deleted ${journeyResult.length} journey progress record(s)`);

    // idea_journey_progress - delete per-idea journey progress
    const ideaJourneyResult = await tx`
      delete from idea_journey_progress
      where user_id = ${targetUserId}
      returning id;
    `;
    console.log(`✓ Deleted ${ideaJourneyResult.length} idea journey progress record(s)`);

    // auth_user - reset chosen_path
    await tx`
      update auth_user
      set
        chosen_path = null,
        path_chosen_at = null,
        trial_ends_at = null
      where id = ${targetUserId};
    `;
    console.log("✓ Reset chosen_path and trial fields");
  });

  console.log("\n✅ Reset complete!");
  await sql.end();
}

async function stripeCall(path: string, method: "DELETE" | "POST" | "GET") {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${method} ${path} failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
