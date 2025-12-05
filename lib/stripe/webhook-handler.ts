import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, wallets } from "@/lib/db/schema";
import { progression, creditLedger, webhookEvents } from "@/lib/db/schema/monetization";
import { monetizationConfig } from "@/lib/config/monetization";
import { stripeGet } from "@/lib/stripe/http";
import { getPlanVariantFromPriceId } from "@/lib/stripe/config";
import { trackEvent } from "@/lib/utils/analytics";
import type { StripeEvent } from "./signature";

/**
 * Ensures a wallet exists for the given user before mana operations.
 * Creates one if it doesn't exist (with onConflictDoNothing for race conditions).
 * Returns the wallet for verification.
 */
async function ensureWalletExists(userId: string): Promise<{ existed: boolean }> {
  const db = getDb();
  const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId));

  if (existing) {
    return { existed: true };
  }

  // Create wallet with default values
  await db.insert(wallets).values({
    userId,
    manaBalance: 0,
    boosterBalance: 0,
  }).onConflictDoNothing();

  console.log(`[Stripe] Created wallet for user ${userId}`);
  return { existed: false };
}

type CheckoutSession = {
  id: string;
  mode: "subscription" | "payment" | string;
  metadata?: Record<string, string> | null;
  customer?: string | null;
  subscription?: string | null;
  amount_total?: number;
  payment_status?: string;
};

type Invoice = {
  id: string;
  subscription?: string | null;
  billing_reason?: string | null;
  lines?: {
    data: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
};

type Subscription = {
  id: string;
  customer?: string | null;
  cancel_at_period_end?: boolean | null;
  // Period dates may be at root level (legacy) or in items (flexible billing)
  current_period_end?: number | null;
  items?: {
    data: Array<{
      current_period_end?: number | null;
      price?: { id?: string | null } | null;
    }>;
  };
  metadata?: Record<string, string> | null;
};

type SubscriptionSchedule = {
  id: string;
  customer: string;
  status: string;
  subscription?: string | null;
  released_subscription?: string | null;
  phases: Array<{
    start_date: number;
    end_date: number;
    items: Array<{ price: string }>;
  }>;
  metadata?: Record<string, string> | null;
};

/**
 * Extracts userId from Stripe event data when available
 */
function extractUserIdFromEvent(event: StripeEvent): string | null {
  const obj = event.data.object as Record<string, unknown>;

  // Check metadata first (most reliable)
  if (obj.metadata && typeof obj.metadata === "object") {
    const metadata = obj.metadata as Record<string, string>;
    if (metadata.userId) return metadata.userId;
  }

  return null;
}

/**
 * Creates a sanitized payload for logging (removes sensitive data)
 */
function sanitizeEventPayload(event: StripeEvent): Record<string, unknown> {
  const obj = event.data.object as Record<string, unknown>;
  return {
    id: obj.id,
    object: obj.object,
    mode: obj.mode,
    status: obj.status,
    billing_reason: obj.billing_reason,
    customer: obj.customer,
    subscription: obj.subscription,
    metadata: obj.metadata,
    // Don't include full line items, amounts, or other PII
  };
}

export async function handleStripeEvent(event: StripeEvent) {
  const db = getDb();
  const userId = extractUserIdFromEvent(event);

  // Log webhook receipt to database
  let webhookLogId: string | null = null;
  try {
    const [webhookLog] = await db.insert(webhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      userId,
      status: "processing",
      payload: sanitizeEventPayload(event),
    }).onConflictDoNothing().returning();

    webhookLogId = webhookLog?.id ?? null;

    // If no log returned, this is a duplicate event - skip processing
    if (!webhookLogId) {
      console.log(`[Stripe] Duplicate webhook event ${event.id} - skipping`);
      return;
    }
  } catch (logError) {
    // Don't fail webhook processing if logging fails
    console.error(`[Stripe] Failed to log webhook event ${event.id}`, logError);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as CheckoutSession);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Invoice);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Subscription);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Subscription);
        break;
      case "subscription_schedule.completed":
      case "subscription_schedule.released":
        await handleSubscriptionScheduleActivated(event.data.object as SubscriptionSchedule);
        break;
      case "subscription_schedule.canceled":
        await handleSubscriptionScheduleCanceled(event.data.object as SubscriptionSchedule);
        break;
      default:
        break;
    }

    // Mark webhook as completed
    if (webhookLogId) {
      await db.update(webhookEvents)
        .set({ status: "completed", processedAt: new Date() })
        .where(eq(webhookEvents.id, webhookLogId));
    }
  } catch (error) {
    // Mark webhook as failed
    if (webhookLogId) {
      await db.update(webhookEvents)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          processedAt: new Date(),
          retryCount: sql`${webhookEvents.retryCount} + 1`,
        })
        .where(eq(webhookEvents.id, webhookLogId));
    }

    // Re-throw to trigger Stripe retry
    throw error;
  }
}

async function handleCheckoutSessionCompleted(session: CheckoutSession) {
  const metadata = session.metadata ?? {};
  const userId = metadata.userId;

  // Non-retriable: Missing userId means bad checkout configuration
  if (!userId) {
    console.error("[Stripe] Missing userId in metadata for session", session.id);
    void trackEvent({
      name: "webhook_invalid_metadata",
      properties: { sessionId: session.id, eventType: "checkout.session.completed", missing: "userId" },
    });
    return; // Don't throw - Stripe retry won't help
  }

  const db = getDb();

  try {

  // 1. Handle Subscription (Sorcerer's Pact)
  if (session.mode === "subscription") {
    console.log(`[Stripe] User ${userId} subscribed to Sorcerer's Pact`);
    const planVariant = metadata.plan === "annual" ? "sorcerer_annual" : "sorcerer_monthly";

    let periodEnd: Date | null = null;
    if (session.subscription) {
      try {
        const sub = await stripeGet<{
          current_period_end?: number | null;
          items?: { data: Array<{ current_period_end?: number | null }> };
        }>(`/subscriptions/${encodeURIComponent(session.subscription)}`);
        // Get period end from items (flexible billing) or root (legacy)
        const periodEndTimestamp = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
        periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000) : null;
      } catch (err) {
        console.error("[Stripe] Failed to fetch subscription period on checkout completion", err);
      }
    }

    // Update User
    await db.update(users).set({
      stripeSubscriptionId: session.subscription,
      stripeCustomerId: session.customer,
      planId: planVariant, // Track billing cadence
      ...(periodEnd ? { subscriptionPeriodEnd: periodEnd } : {}),
    }).where(eq(users.id, userId));

    // Grant Initial Core Mana
    const coreManaAmount = monetizationConfig.mana.corePerMonthMana;

    // Ensure wallet exists before attempting mana grant
    await ensureWalletExists(userId);

    // Update wallet with mana grant and verify it succeeded using .returning()
    const [updatedWallet] = await db.update(wallets).set({
      manaBalance: sql`${wallets.manaBalance} + ${coreManaAmount}`,
      lastCoreGrantAt: new Date(),
    }).where(eq(wallets.userId, userId)).returning();

    // Verify the update affected a row - critical for detecting silent failures
    if (!updatedWallet) {
      const error = `CRITICAL: Mana grant failed - wallet update returned no rows for user ${userId}`;
      console.error(`[Stripe] ${error}`, { sessionId: session.id, coreManaAmount });
      void trackEvent({
        name: "webhook_mana_grant_failed",
        properties: { userId, amount: coreManaAmount, type: "subscription_checkout", error },
      });
      throw new Error(error);
    }

    // Log to credit ledger for audit trail
    await db.insert(creditLedger).values({
      userId,
      amount: coreManaAmount,
      type: "credit",
      bucket: "mana",
      reason: "subscription_grant",
      referenceType: "subscription",
      referenceId: session.subscription ?? session.id,
      balanceAfter: updatedWallet?.manaBalance ?? coreManaAmount,
    });

    console.log(`[Stripe] Granted ${coreManaAmount} Core Mana to ${userId}`);
    void trackEvent({
      name: "webhook_mana_granted",
      properties: {
        userId,
        amount: coreManaAmount,
        type: "subscription_checkout",
        subscriptionId: session.subscription,
      },
    });
    return;
  }

  // 2. Handle Payment (Booster Mana)
  if (session.mode === "payment" && session.payment_status === "paid") {
    const boosterAmount = parseInt(metadata.boosterAmount || "0", 10);

    if (boosterAmount > 0) {
      console.log(`[Stripe] User ${userId} purchased ${boosterAmount} Booster Mana`);

      // Ensure wallet exists before attempting booster grant
      await ensureWalletExists(userId);

      // Update wallet with booster grant and verify it succeeded using .returning()
      const [updatedWallet] = await db.update(wallets).set({
        boosterBalance: sql`${wallets.boosterBalance} + ${boosterAmount}`,
      }).where(eq(wallets.userId, userId)).returning();

      // Verify the update succeeded
      if (!updatedWallet) {
        const error = `CRITICAL: Booster grant failed - wallet update returned no rows for user ${userId}`;
        console.error(`[Stripe] ${error}`, { sessionId: session.id, boosterAmount });
        void trackEvent({
          name: "webhook_booster_grant_failed",
          properties: { userId, amount: boosterAmount, error },
        });
        throw new Error(error);
      }

      // Log to credit ledger for audit trail
      await db.insert(creditLedger).values({
        userId,
        amount: boosterAmount,
        type: "credit",
        bucket: "booster",
        reason: "booster_purchase",
        referenceType: "booster",
        referenceId: session.id,
        balanceAfter: updatedWallet?.boosterBalance ?? boosterAmount,
      });

      void trackEvent({
        name: "webhook_booster_granted",
        properties: { userId, amount: boosterAmount, sessionId: session.id },
      });
    }
  }
  } catch (error) {
    // Log error with full context for debugging
    console.error(`[Stripe] CRITICAL: Failed to process checkout for user ${userId}`, {
      sessionId: session.id,
      mode: session.mode,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    void trackEvent({
      name: "webhook_processing_failed",
      properties: {
        userId,
        eventType: "checkout.session.completed",
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    // Re-throw to trigger Stripe retry
    throw error;
  }
}

async function handleInvoicePaid(invoice: Invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // We only care about subscription renewals here
  if (invoice.billing_reason !== "subscription_cycle") return;

  const db = getDb();

  // Find user by subscription ID
  const [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId));

  if (!user) {
    // Non-retriable error - user doesn't exist for this subscription
    console.error(`[Stripe] No user found for subscription ${subscriptionId}`, { invoiceId: invoice.id });
    void trackEvent({
      name: "webhook_user_not_found",
      properties: { subscriptionId, invoiceId: invoice.id, eventType: "invoice.paid" },
    });
    return; // Don't throw - Stripe retry won't help
  }

  try {
    // Grant Monthly Core Mana
    const coreManaAmount = monetizationConfig.mana.corePerMonthMana;

    // Ensure wallet exists before attempting mana grant
    await ensureWalletExists(user.id);

    // Update wallet with mana grant and verify it succeeded using .returning()
    const [updatedWallet] = await db.update(wallets).set({
      manaBalance: sql`${wallets.manaBalance} + ${coreManaAmount}`,
      lastCoreGrantAt: new Date(),
    }).where(eq(wallets.userId, user.id)).returning();

    // Verify the update affected a row - critical for detecting silent failures
    if (!updatedWallet) {
      const error = `CRITICAL: Mana renewal grant failed - wallet update returned no rows for user ${user.id}`;
      console.error(`[Stripe] ${error}`, { invoiceId: invoice.id, subscriptionId, coreManaAmount });
      void trackEvent({
        name: "webhook_mana_grant_failed",
        properties: { userId: user.id, amount: coreManaAmount, type: "subscription_renewal", error },
      });
      throw new Error(error);
    }

    // Log to credit ledger for audit trail
    await db.insert(creditLedger).values({
      userId: user.id,
      amount: coreManaAmount,
      type: "credit",
      bucket: "mana",
      reason: "subscription_renewal",
      referenceType: "subscription",
      referenceId: subscriptionId,
      balanceAfter: updatedWallet?.manaBalance ?? coreManaAmount,
    });

    console.log(`[Stripe] Renewed ${coreManaAmount} Core Mana for ${user.id}`);
    void trackEvent({
      name: "webhook_mana_granted",
      properties: {
        userId: user.id,
        amount: coreManaAmount,
        type: "subscription_renewal",
        subscriptionId,
      },
    });
  } catch (error) {
    // Log error with full context for debugging
    console.error(`[Stripe] CRITICAL: Failed to process invoice renewal for user ${user.id}`, {
      invoiceId: invoice.id,
      subscriptionId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    void trackEvent({
      name: "webhook_processing_failed",
      properties: {
        userId: user.id,
        eventType: "invoice.paid",
        invoiceId: invoice.id,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    // Re-throw to trigger Stripe retry
    throw error;
  }
}

/**
 * Handle new subscription creation - this fires when a schedule activates and creates a new subscription
 */
async function handleSubscriptionCreated(subscription: Subscription) {
  if (!subscription.id || !subscription.customer) return;

  const db = getDb();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer;

  // Find user by customer ID (since new subscription won't match old subscription ID)
  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    console.log(`[Stripe] Subscription created for unknown customer ${customerId}`);
    return;
  }

  // Get price ID and period end from items
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const periodEndTimestamp = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
  const periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000) : null;

  const planVariant = getPlanVariantFromPriceId(priceId);

  if (!planVariant) {
    console.log(`[Stripe] Subscription ${subscription.id} has unknown price ${priceId}`);
    return;
  }

  console.log(`[Stripe] New subscription ${subscription.id} created for user ${user.id}: plan=${planVariant}`);

  // Update user with new subscription ID and plan
  await db.update(users).set({
    stripeSubscriptionId: subscription.id,
    planId: planVariant,
    ...(periodEnd ? { subscriptionPeriodEnd: periodEnd } : {}),
  }).where(eq(users.id, user.id));
}

async function handleSubscriptionDeleted(subscription: Subscription) {
  if (!subscription.id) return;

  const db = getDb();

  // Find user by subscription ID first
  let [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscription.id));

  // If not found by subscription ID, try customer ID (for scheduled subscriptions)
  if (!user && subscription.customer) {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer;
    [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
  }

  if (!user) return;

  // Only downgrade if this is the user's current subscription
  if (user.stripeSubscriptionId === subscription.id) {
    console.log(`[Stripe] Subscription ${subscription.id} deleted for user ${user.id}`);

    // Downgrade to Wanderer
    await db.update(users).set({
      planId: "wanderer",
      stripeSubscriptionId: null,
    }).where(eq(users.id, user.id));
  } else {
    console.log(`[Stripe] Subscription ${subscription.id} deleted but user ${user.id} has different active subscription`);
  }
}

async function handleSubscriptionUpdated(subscription: Subscription) {
  if (!subscription.id) return;
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscription.id));
  if (!user) return;

  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

  // Get price ID and period end from items (flexible billing) or root (legacy)
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const periodEndTimestamp = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
  const periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000) : null;

  let ensuredPeriodEnd = periodEnd;
  let ensuredPriceId = priceId;

  if (!ensuredPeriodEnd || !ensuredPriceId) {
    try {
      const refreshed = await stripeGet<{
        current_period_end?: number | null;
        items?: { data: Array<{ current_period_end?: number | null; price?: { id?: string } }> };
      }>(`/subscriptions/${encodeURIComponent(subscription.id)}`);
      const refreshedTimestamp = refreshed.items?.data?.[0]?.current_period_end ?? refreshed.current_period_end;
      ensuredPeriodEnd = ensuredPeriodEnd ?? (refreshedTimestamp ? new Date(refreshedTimestamp * 1000) : null);
      ensuredPriceId = ensuredPriceId ?? refreshed.items?.data?.[0]?.price?.id ?? null;
    } catch (err) {
      console.error("[Stripe] Failed to refresh subscription during update webhook", err);
    }
  }

  // Determine plan from actual price ID, not metadata
  const planVariant = getPlanVariantFromPriceId(ensuredPriceId) ?? user.planId ?? "sorcerer_monthly";

  console.log(`[Stripe] Subscription ${subscription.id} updated: price=${ensuredPriceId}, plan=${planVariant}, cancelAtPeriodEnd=${cancelAtPeriodEnd}`);

  // Always persist the latest known renewal boundary so UI and upgrades have a local fallback.
  await db.update(users).set({
    planId: planVariant,
    ...(ensuredPeriodEnd ? { subscriptionPeriodEnd: ensuredPeriodEnd } : {}),
  }).where(eq(users.id, user.id));

  // Persist cancellation intent and keep service active until period end.
  // We reuse progression.isChanneling/channelingExpiresAt to track access window.
  if (cancelAtPeriodEnd && ensuredPeriodEnd) {
    await db.update(progression).set({
      isChanneling: true,
      channelingExpiresAt: ensuredPeriodEnd,
    }).where(eq(progression.userId, user.id));
  } else if (!cancelAtPeriodEnd) {
    // If cancellation intent removed, clear expiry marker (but keep last known period end on user)
    await db.update(progression).set({
      isChanneling: true,
      channelingExpiresAt: null,
    }).where(eq(progression.userId, user.id));
  }
}

/**
 * Handle subscription schedule activation (when the scheduled annual plan kicks in)
 */
async function handleSubscriptionScheduleActivated(schedule: SubscriptionSchedule) {
  const userId = schedule.metadata?.userId;
  if (!userId) {
    console.log(`[Stripe] Schedule ${schedule.id} activated but no userId in metadata`);
    return;
  }

  const db = getDb();

  // The schedule's subscription field contains the new subscription ID
  const newSubscriptionId = schedule.subscription ?? schedule.released_subscription;

  if (newSubscriptionId) {
    // Fetch the new subscription to get details
    try {
      const sub = await stripeGet<{
        id: string;
        items?: { data: Array<{ price?: { id?: string }; current_period_end?: number }> };
        current_period_end?: number;
      }>(`/subscriptions/${encodeURIComponent(newSubscriptionId)}`);

      const priceId = sub.items?.data?.[0]?.price?.id ?? null;
      const periodEndTimestamp = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
      const periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000) : null;
      const planVariant = getPlanVariantFromPriceId(priceId);

      console.log(`[Stripe] Schedule ${schedule.id} activated for user ${userId}: new subscription ${newSubscriptionId}, plan=${planVariant}`);

      await db.update(users).set({
        stripeSubscriptionId: newSubscriptionId,
        planId: planVariant ?? "sorcerer_annual",
        ...(periodEnd ? { subscriptionPeriodEnd: periodEnd } : {}),
      }).where(eq(users.id, userId));
    } catch (err) {
      console.error(`[Stripe] Failed to fetch new subscription ${newSubscriptionId} from schedule activation`, err);
    }
  } else {
    console.log(`[Stripe] Schedule ${schedule.id} activated but no subscription ID found`);
  }
}

/**
 * Handle subscription schedule cancellation (user canceled the scheduled upgrade)
 */
async function handleSubscriptionScheduleCanceled(schedule: SubscriptionSchedule) {
  const userId = schedule.metadata?.userId;
  if (!userId) {
    console.log(`[Stripe] Schedule ${schedule.id} canceled but no userId in metadata`);
    return;
  }

  console.log(`[Stripe] Schedule ${schedule.id} canceled for user ${userId}`);

  // The scheduled upgrade was canceled - if the user still has an active monthly,
  // we should un-cancel it so they continue on monthly
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user?.stripeSubscriptionId) return;

  // Check if the current subscription is set to cancel at period end
  try {
    const sub = await stripeGet<{
      id: string;
      cancel_at_period_end: boolean;
      status: string;
    }>(`/subscriptions/${encodeURIComponent(user.stripeSubscriptionId)}`);

    // If the monthly was set to cancel (because of the upgrade), but now the upgrade is canceled,
    // we might want to keep the monthly going. However, this depends on business logic.
    // For now, just log it - the user would need to manually re-subscribe or un-cancel.
    if (sub.cancel_at_period_end && sub.status === "active") {
      console.log(`[Stripe] User ${userId}'s monthly subscription is still set to cancel. They may need to re-subscribe.`);
    }
  } catch (err) {
    console.error(`[Stripe] Failed to check subscription status after schedule cancellation`, err);
  }
}
