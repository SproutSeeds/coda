"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { users, gifts } from "@/lib/db/schema";
import { refundRequests, wallets, progression } from "@/lib/db/schema/monetization";
import { monetizationConfig } from "@/lib/config/monetization";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { getPlanPriceId, getBoosterPriceId, stripeEnv } from "@/lib/stripe/config";
import { stripePost, stripeGet } from "@/lib/stripe/http";
import { ensureStripeCustomer } from "@/lib/stripe/customers";
import { createFutureSubscriptionSchedule, findScheduledUpgrade, cancelSubscriptionSchedule } from "@/lib/stripe/subscriptions";
import { consumeConfiguredRateLimit, BILLING_RATE_LIMITS } from "@/lib/utils/rate-limit";
import {
    sendRefundConfirmationEmail,
    sendGiftReceivedEmail,
    sendGiftSentConfirmationEmail,
    sendGiftAcceptedEmail,
    sendAdminRefundRequestEmail,
    sendAnnualUpgradeScheduledEmail,
} from "@/lib/email/billing-notifications";
import { trackEvent } from "@/lib/utils/analytics";

const SELF_SERVICE_REFUND_WINDOW_DAYS = 7;

const db = getDb();

export async function subscribeAction(formData: FormData) {
    const user = await requireUser();

    // Rate limit: 10 subscribe attempts per hour
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:subscribe:${user.id}`,
        BILLING_RATE_LIMITS.subscribe
    );
    if (!rateLimit.success) {
        throw new Error("Too many subscription attempts. Please try again later.");
    }

    const plan = (formData.get("plan") as string) === "annual" ? "annual" : "monthly";

    // Get user details for Stripe
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    if (!dbUser) throw new Error("User not found");

    const hasActivePact =
        Boolean(dbUser.stripeSubscriptionId) &&
        Boolean(dbUser.planId && dbUser.planId.startsWith("sorcerer"));

    // If already subscribed, redirect to manage portal instead of selling again
    if (hasActivePact && dbUser.stripeCustomerId) {
        const session = await stripePost<{ url: string }>("/billing_portal/sessions", new URLSearchParams({
            customer: dbUser.stripeCustomerId,
            return_url: `${stripeEnv.appBaseUrl}/dashboard/billing`,
        }));
        if (session.url) {
            redirect(session.url);
        }
        redirect("/dashboard/billing");
    }

    const session = await createCheckoutSession({
        mode: "subscription",
        priceId: getPlanPriceId(plan),
        successUrl: `${stripeEnv.appBaseUrl}/dashboard/billing?success=true`,
        cancelUrl: `${stripeEnv.appBaseUrl}/dashboard/billing?canceled=true`,
        customerId: dbUser.stripeCustomerId,
        customerEmail: dbUser.email,
        metadata: {
            userId: user.id,
            plan,
        },
    });

    if (session.url) {
        redirect(session.url);
    }
}

export async function manageSubscriptionAction() {
    const user = await requireUser();
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    const customerId = dbUser?.stripeCustomerId
        ? dbUser.stripeCustomerId
        : await ensureStripeCustomer(user.id, { db });

    const session = await stripePost<{ url: string }>("/billing_portal/sessions", new URLSearchParams({
        customer: customerId,
        return_url: `${stripeEnv.appBaseUrl}/dashboard/billing`,
    }));

    if (session.url) {
        redirect(session.url);
    }
}

export async function upgradeToAnnualAction() {
    const user = await requireUser();

    // Rate limit: 3 upgrade attempts per hour
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:upgrade:${user.id}`,
        BILLING_RATE_LIMITS.upgradeToAnnual
    );
    if (!rateLimit.success) {
        redirect("/dashboard/billing?upgrade=rate_limited");
    }

    const [fetchedUser] = await db.select().from(users).where(eq(users.id, user.id));

    if (!fetchedUser) throw new Error("User not found");
    const customerId = fetchedUser.stripeCustomerId
        ? fetchedUser.stripeCustomerId
        : await ensureStripeCustomer(user.id, { db });

    if (!fetchedUser.stripeSubscriptionId) {
        throw new Error("No active subscription found");
    }

    // Keep a mutable copy for local updates
    let dbUser = { ...fetchedUser };
    const subscriptionId = fetchedUser.stripeSubscriptionId;

    // Prevent duplicate annual subs on this customer
    const annualPriceId = getPlanPriceId("annual");
    const existingSubs = await stripeGet<{
        data: Array<{
            id: string;
            status: string;
            cancel_at_period_end: boolean;
            items: { data: Array<{ price: { id: string | null } | null }> };
        }>;
    }>(`/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`);
    const hasAnnual = existingSubs.data.some(
        (s) =>
            s.items?.data?.some((i) => i.price?.id === annualPriceId) &&
            (s.status === "active" || s.status === "trialing" || s.status === "past_due" || s.cancel_at_period_end)
    );
    if (hasAnnual) {
        redirect("/dashboard/billing?upgrade=already_annual");
    }

    // Fetch current subscription to get period end
    const sub = await stripeGet<{
        id: string;
        current_period_end?: number;
        status: string;
        items?: { data: Array<{ current_period_end?: number }> };
    }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);

    if (sub.status !== "active" && sub.status !== "trialing") {
        throw new Error("Subscription is not active");
    }

    // Get period end from items (flexible billing) or root (legacy)
    const periodEndTimestamp = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
    const periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000) : null;
    if (periodEnd && (!dbUser.subscriptionPeriodEnd || dbUser.subscriptionPeriodEnd.getTime() !== periodEnd.getTime())) {
        await db.update(users).set({ subscriptionPeriodEnd: periodEnd }).where(eq(users.id, user.id));
        dbUser = { ...dbUser, subscriptionPeriodEnd: periodEnd };
    }

    let trialEndUnix = periodEndTimestamp ?? null;
    if (!trialEndUnix && dbUser.subscriptionPeriodEnd) {
        const asEpoch = Math.floor(dbUser.subscriptionPeriodEnd.getTime() / 1000);
        if (asEpoch > Math.floor(Date.now() / 1000)) {
            trialEndUnix = asEpoch;
        }
    }
    if (!trialEndUnix) {
        redirect("/dashboard/billing?upgrade=missing_period_end");
    }

    // Cancel current monthly at period end (avoid double-billing)
    await stripePost(`/subscriptions/${encodeURIComponent(subscriptionId)}`, new URLSearchParams({
        cancel_at_period_end: "true",
    }));

    // Schedule annual to start when monthly ends
    await createFutureSubscriptionSchedule({
        customerId,
        priceId: annualPriceId,
        startDate: trialEndUnix,
        metadata: {
            userId: user.id,
            plan: "annual",
        },
    });

    // Send email notification
    const { pricing } = monetizationConfig;
    const annualSavings = (pricing.monthlyUsd * 12) - pricing.annualUsd;
    void sendAnnualUpgradeScheduledEmail({
        email: dbUser.email ?? "",
        startDate: new Date(trialEndUnix * 1000),
        savingsAmount: annualSavings,
    });

    // Track analytics
    void trackEvent({
        name: "billing_subscription_upgraded",
        properties: {
            userId: user.id,
            fromPlan: "monthly",
            toPlan: "annual",
            savingsAmount: annualSavings,
        },
    });

    redirect("/dashboard/billing?upgrade=scheduled");
}

/**
 * Cancel a scheduled annual upgrade.
 * This releases the subscription schedule and reactivates the monthly subscription
 * (undoing the cancel_at_period_end that was set during upgrade scheduling).
 */
export async function cancelScheduledUpgradeAction(): Promise<{ success?: boolean; error?: string }> {
    const user = await requireUser();

    // Rate limit: 5 cancel attempts per hour
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:cancel-upgrade:${user.id}`,
        BILLING_RATE_LIMITS.cancelScheduledUpgrade
    );
    if (!rateLimit.success) {
        return { error: "Too many attempts. Please try again later." };
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    if (!dbUser?.stripeCustomerId) {
        return { error: "No billing account found" };
    }

    try {
        // Find the scheduled annual upgrade
        const annualPriceId = getPlanPriceId("annual");
        const schedule = await findScheduledUpgrade({
            customerId: dbUser.stripeCustomerId,
            annualPriceId,
        });

        if (!schedule) {
            return { error: "No scheduled upgrade found" };
        }

        // Cancel the subscription schedule
        await cancelSubscriptionSchedule(schedule.id);

        // Reactivate the monthly subscription (undo cancel_at_period_end)
        if (dbUser.stripeSubscriptionId) {
            await stripePost(`/subscriptions/${encodeURIComponent(dbUser.stripeSubscriptionId)}`, new URLSearchParams({
                cancel_at_period_end: "false",
            }));
        }

        // Track analytics
        void trackEvent({
            name: "billing_scheduled_upgrade_cancelled",
            properties: { userId: user.id },
        });

        revalidatePath("/dashboard/billing");
        redirect("/dashboard/billing?upgrade=cancelled");
    } catch (err) {
        console.error("[Billing] Failed to cancel scheduled upgrade", err);
        return { error: "Failed to cancel scheduled upgrade. Please try again." };
    }
}

/**
 * Reactivate a cancelled subscription (undo cancel_at_period_end or cancel_at).
 * This is used when a user wants to continue their subscription after cancelling.
 */
export async function renewSubscriptionAction(): Promise<{ success?: boolean; error?: string }> {
    const user = await requireUser();

    // Aggressive rate limit: 3 toggles per minute (shared with cancel action)
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:subscription-toggle:${user.id}`,
        BILLING_RATE_LIMITS.subscriptionToggle
    );
    if (!rateLimit.success) {
        const waitSeconds = Math.ceil((rateLimit.reset - Date.now()) / 1000);
        return { error: `Too many changes. Please wait ${waitSeconds} seconds before trying again.` };
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    if (!dbUser?.stripeSubscriptionId) {
        return { error: "No subscription found to renew" };
    }

    try {
        // First, clear cancel_at_period_end
        const body1 = new URLSearchParams();
        body1.set("cancel_at_period_end", "false");
        await stripePost(`/subscriptions/${encodeURIComponent(dbUser.stripeSubscriptionId)}`, body1);

        // Then, separately clear cancel_at (Stripe may use this instead of cancel_at_period_end)
        // Passing empty string clears the scheduled cancellation date
        try {
            const body2 = new URLSearchParams();
            body2.set("cancel_at", "");
            await stripePost(`/subscriptions/${encodeURIComponent(dbUser.stripeSubscriptionId)}`, body2);
        } catch (cancelAtErr) {
            // Stripe may reject empty cancel_at if it wasn't set - that's OK
            console.log("[Billing] Note: cancel_at clear failed (may not have been set)", cancelAtErr);
        }

        // Track analytics
        void trackEvent({
            name: "billing_subscription_started",
            properties: { userId: user.id, action: "renewed" },
        });

        revalidatePath("/dashboard/billing");
        redirect("/dashboard/billing?renewed=true");
    } catch (err) {
        console.error("[Billing] Failed to renew subscription", err);
        return { error: "Failed to renew subscription. Please try again." };
    }
}

/**
 * Cancel subscription at period end.
 * This is a one-click cancel that sets cancel_at_period_end to true.
 */
export async function cancelSubscriptionAction(): Promise<{ success?: boolean; error?: string }> {
    const user = await requireUser();

    // Aggressive rate limit: 3 toggles per minute (shared with renew action)
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:subscription-toggle:${user.id}`,
        BILLING_RATE_LIMITS.subscriptionToggle
    );
    if (!rateLimit.success) {
        const waitSeconds = Math.ceil((rateLimit.reset - Date.now()) / 1000);
        return { error: `Too many changes. Please wait ${waitSeconds} seconds before trying again.` };
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    if (!dbUser?.stripeSubscriptionId) {
        return { error: "No subscription found to cancel" };
    }

    try {
        // Set subscription to cancel at period end
        const body = new URLSearchParams();
        body.set("cancel_at_period_end", "true");

        await stripePost(`/subscriptions/${encodeURIComponent(dbUser.stripeSubscriptionId)}`, body);

        // Track analytics
        void trackEvent({
            name: "billing_subscription_cancelled",
            properties: { userId: user.id },
        });

        revalidatePath("/dashboard/billing");
        redirect("/dashboard/billing?cancelled=true");
    } catch (err) {
        console.error("[Billing] Failed to cancel subscription", err);
        return { error: "Failed to cancel subscription. Please try again." };
    }
}

export async function buyBoosterAction() {
    const user = await requireUser();
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    if (!dbUser) throw new Error("User not found");

    const session = await createCheckoutSession({
        mode: "payment",
        priceId: getBoosterPriceId(),
        successUrl: `${stripeEnv.appBaseUrl}/dashboard/billing?booster_success=true`,
        cancelUrl: `${stripeEnv.appBaseUrl}/dashboard/billing?canceled=true`,
        customerId: dbUser.stripeCustomerId,
        customerEmail: dbUser.email,
        metadata: {
            userId: user.id,
            boosterAmount: "50000", // Hardcoded for now, should match price
        },
    });

    if (session.url) {
        redirect(session.url);
    }
}

// --- Referral Actions ---

export async function generateReferralLinkAction() {
    const user = await requireUser();
    // In this simple implementation, the link is just the user ID
    // Real implementation might generate a unique code
    return { success: true, link: `${process.env.NEXT_PUBLIC_SITE_URL}/signup?ref=${user.id}` };
}

// --- Gift Actions ---

export async function sendGiftAction(formData: FormData) {
    const user = await requireUser();

    // Rate limit: 5 gifts per day
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:gift:${user.id}`,
        BILLING_RATE_LIMITS.sendGift
    );
    if (!rateLimit.success) {
        return { error: "You've reached the daily gift limit. Please try again tomorrow." };
    }

    const recipientEmail = formData.get("email") as string;

    if (!recipientEmail) {
        return { error: "Email is required" };
    }

    // 1. Find Recipient
    const [recipient] = await db.select().from(users).where(eq(users.email, recipientEmail));

    if (!recipient) {
        // In a real app, we might create a pending invite or send an email to join
        return { error: "User not found. Ask them to join first!" };
    }

    if (recipient.id === user.id) {
        return { error: "You cannot gift yourself." };
    }

    // 2. Check Limits (Max 3 per month)
    // TODO: Implement limit check

    // 3. Create Gift Record
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.insert(gifts).values({
        senderId: user.id,
        recipientId: recipient.id,
        status: "pending",
        expiresAt,
    });

    // 4. Send Email Notifications
    // Get sender's email for the sender's user
    const [sender] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, user.id));
    const senderName = sender?.name ?? sender?.email ?? "A friend";

    // Send to recipient
    void sendGiftReceivedEmail({
        recipientEmail,
        senderName,
        expiresAt,
        claimUrl: `${stripeEnv.appBaseUrl}/dashboard/billing?gift=pending`,
    });

    // Send confirmation to sender
    void sendGiftSentConfirmationEmail({
        senderEmail: sender?.email ?? "",
        recipientEmail,
    });

    // Track analytics
    void trackEvent({
        name: "billing_gift_sent",
        properties: {
            senderId: user.id,
            recipientEmail,
        },
    });

    return { success: true };
}

export async function claimGiftAction(giftId: string) {
    const user = await requireUser();

    // 1. Find Gift
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId));

    if (!gift) return { error: "Gift not found" };
    if (gift.recipientId !== user.id) return { error: "This gift is not for you" };
    if (gift.status !== "pending") return { error: "Gift already claimed or expired" };

    // Check if gift has expired
    if (gift.expiresAt < new Date()) {
        await db.update(gifts).set({ status: "expired" }).where(eq(gifts.id, giftId));
        return { error: "This gift has expired" };
    }

    // 2. Activate Premium (Mock for now, or real DB update)
    // In real app, this might grant a month of "Sorcerer" status without Stripe
    await db.update(users).set({
        planId: "sorcerer",
        // We might need a 'giftExpiresAt' column if not using Stripe
    }).where(eq(users.id, user.id));

    // 3. Update Gift Status
    await db.update(gifts).set({
        status: "accepted",
    }).where(eq(gifts.id, giftId));

    // 4. Send notification to sender that gift was accepted
    const [sender] = await db.select({ email: users.email }).from(users).where(eq(users.id, gift.senderId));
    const [recipient] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, user.id));
    if (sender?.email) {
        void sendGiftAcceptedEmail({
            senderEmail: sender.email,
            recipientName: recipient?.name ?? recipient?.email ?? "Someone",
        });
    }

    // Track analytics
    void trackEvent({
        name: "billing_gift_accepted",
        properties: {
            recipientId: user.id,
            senderId: gift.senderId,
            giftId,
        },
    });

    return { success: true };
}

/**
 * Cancel a pending gift (sender only)
 */
export async function cancelGiftAction(giftId: string): Promise<{ success?: boolean; error?: string }> {
    const user = await requireUser();

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId));

    if (!gift) return { error: "Gift not found" };
    if (gift.senderId !== user.id) return { error: "You can only cancel gifts you sent" };
    if (gift.status !== "pending") return { error: "Can only cancel pending gifts" };

    // Delete the gift record (sender cancelled before recipient accepted)
    await db.delete(gifts).where(eq(gifts.id, giftId));

    return { success: true };
}

/**
 * Decline a gift (recipient only)
 */
export async function declineGiftAction(giftId: string): Promise<{ success?: boolean; error?: string }> {
    const user = await requireUser();

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId));

    if (!gift) return { error: "Gift not found" };
    if (gift.recipientId !== user.id) return { error: "This gift is not for you" };
    if (gift.status !== "pending") return { error: "Can only decline pending gifts" };

    // Mark as expired (declined is treated like expired for audit purposes)
    await db.update(gifts).set({
        status: "expired",
    }).where(eq(gifts.id, giftId));

    return { success: true };
}

/**
 * Get pending gifts for the current user (received gifts)
 */
export async function getPendingGiftsAction(): Promise<{
    gifts: Array<{
        id: string;
        senderEmail: string;
        expiresAt: Date;
        createdAt: Date;
    }>;
    error?: string;
}> {
    const user = await requireUser();

    const pendingGifts = await db
        .select({
            id: gifts.id,
            senderId: gifts.senderId,
            expiresAt: gifts.expiresAt,
            createdAt: gifts.createdAt,
        })
        .from(gifts)
        .where(and(
            eq(gifts.recipientId, user.id),
            eq(gifts.status, "pending")
        ));

    // Get sender emails
    const senderIds = pendingGifts.map(g => g.senderId);
    const senders = senderIds.length > 0
        ? await db.select({ id: users.id, email: users.email }).from(users).where(
            // Simple approach: query each sender (fine for small numbers)
            eq(users.id, senderIds[0])
        )
        : [];

    // For multiple senders, we'd need an IN query - for now keep it simple
    const senderMap = new Map(senders.map(s => [s.id, s.email]));

    return {
        gifts: pendingGifts.map(g => ({
            id: g.id,
            senderEmail: senderMap.get(g.senderId) ?? "Unknown",
            expiresAt: g.expiresAt,
            createdAt: g.createdAt,
        })),
    };
}

/**
 * Get gifts sent by the current user
 */
export async function getSentGiftsAction(): Promise<{
    gifts: Array<{
        id: string;
        recipientEmail: string;
        status: string;
        expiresAt: Date;
        createdAt: Date;
    }>;
    error?: string;
}> {
    const user = await requireUser();

    const sentGifts = await db
        .select({
            id: gifts.id,
            recipientId: gifts.recipientId,
            status: gifts.status,
            expiresAt: gifts.expiresAt,
            createdAt: gifts.createdAt,
        })
        .from(gifts)
        .where(eq(gifts.senderId, user.id))
        .orderBy(desc(gifts.createdAt))
        .limit(20);

    // Get recipient emails (simplified - in production use a JOIN or batch query)
    const recipientIds = [...new Set(sentGifts.map(g => g.recipientId))];
    const recipients = recipientIds.length > 0
        ? await db.select({ id: users.id, email: users.email }).from(users).where(
            eq(users.id, recipientIds[0]) // Simplified for now
        )
        : [];

    const recipientMap = new Map(recipients.map(r => [r.id, r.email]));

    return {
        gifts: sentGifts.map(g => ({
            id: g.id,
            recipientEmail: recipientMap.get(g.recipientId) ?? "Unknown",
            status: g.status,
            expiresAt: g.expiresAt,
            createdAt: g.createdAt,
        })),
    };
}

// --- Refund Actions ---

type RefundableCharge = {
    id: string;
    chargeId: string;
    invoiceId: string | null;
    amountCents: number;
    description: string;
    createdAt: Date;
    isWithinWindow: boolean;
    hasPendingRequest: boolean;
};

/**
 * Get the user's refundable charges (recent payments)
 */
export async function getRefundableCharges(): Promise<{ charges: RefundableCharge[]; error?: string }> {
    const user = await requireUser();
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    if (!dbUser?.stripeCustomerId) {
        return { charges: [] };
    }

    try {
        // Get recent charges for this customer
        const charges = await stripeGet<{
            data: Array<{
                id: string;
                amount: number;
                description: string | null;
                created: number;
                refunded: boolean;
                invoice: string | null;
                payment_intent: string | null;
            }>;
        }>(`/charges?customer=${encodeURIComponent(dbUser.stripeCustomerId)}&limit=10`);

        // Get existing pending refund requests for this user
        const pendingRequests = await db.select()
            .from(refundRequests)
            .where(and(
                eq(refundRequests.userId, user.id),
                eq(refundRequests.status, "pending")
            ));

        const pendingChargeIds = new Set(pendingRequests.map(r => r.stripeChargeId));

        const now = Date.now();
        const windowMs = SELF_SERVICE_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

        const refundableCharges: RefundableCharge[] = charges.data
            .filter(c => !c.refunded && c.amount > 0)
            .map(c => {
                const createdAt = new Date(c.created * 1000);
                return {
                    id: c.payment_intent ?? c.id,
                    chargeId: c.id,
                    invoiceId: c.invoice,
                    amountCents: c.amount,
                    description: c.description ?? "Payment",
                    createdAt,
                    isWithinWindow: now - createdAt.getTime() <= windowMs,
                    hasPendingRequest: pendingChargeIds.has(c.id),
                };
            });

        return { charges: refundableCharges };
    } catch (err) {
        console.error("[Refund] Failed to fetch charges", err);
        return { charges: [], error: "Failed to load payment history" };
    }
}

/**
 * Get refund estimate - shows user what they'll get back before confirming
 */
export async function getRefundEstimate(): Promise<{
    manaUsed: number;
    manaGranted: number;
    usageCostCents: number;
    error?: string;
}> {
    const user = await requireUser();
    const { usageCostCents, manaUsed, manaGranted } = await calculateManaUsageCostInternal(user.id);
    return { manaUsed, manaGranted, usageCostCents };
}

/**
 * Calculate the mana usage cost in cents
 * Returns the cost of mana the user has consumed since their subscription started
 */
async function calculateManaUsageCostInternal(userId: string): Promise<{ usageCostCents: number; manaUsed: number; manaGranted: number }> {
    // Get user's wallet to see current mana balance
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));

    if (!wallet) {
        return { usageCostCents: 0, manaUsed: 0, manaGranted: 0 };
    }

    // Core mana granted per month from subscription
    const manaGranted = monetizationConfig.mana.corePerMonthMana; // 200,000 mana

    // CRITICAL: Check if mana was actually granted via the webhook
    // If lastCoreGrantAt is null, the subscription webhook never fired properly
    // and we should NOT charge the user for "usage" they never had access to
    if (!wallet.lastCoreGrantAt) {
        console.warn(`[Refund] User ${userId} has no lastCoreGrantAt - mana was never granted, charging $0 for usage`);
        return { usageCostCents: 0, manaUsed: 0, manaGranted: 0 };
    }

    // Calculate mana used: granted - remaining balance
    // Only count core mana usage, not booster (booster is separate purchase)
    const manaUsed = Math.max(0, manaGranted - wallet.manaBalance);

    // Convert mana used to USD: mana / usdToMana = USD
    // usdToMana = 20,000 (meaning 1 USD = 20,000 mana)
    const usageCostUsd = manaUsed / monetizationConfig.mana.usdToMana;
    const usageCostCents = Math.ceil(usageCostUsd * 100); // Round up to be fair to us

    return { usageCostCents, manaUsed, manaGranted };
}

/**
 * Self-service refund (within 7 days) - processes immediately
 * Calculates mana usage cost and issues a PARTIAL refund (charge - usage cost)
 * Immediately cancels subscription and revokes all access
 */
export async function selfServiceRefundAction(formData: FormData): Promise<{
    success?: boolean;
    error?: string;
    refundedAmountCents?: number;
    usageCostCents?: number;
}> {
    const user = await requireUser();

    // Rate limit: 1 self-service refund per day
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:self-refund:${user.id}`,
        BILLING_RATE_LIMITS.selfServiceRefund
    );
    if (!rateLimit.success) {
        return { error: "You can only request one self-service refund per day. Please try again tomorrow." };
    }

    const chargeId = formData.get("chargeId") as string;
    const reason = formData.get("reason") as string;

    if (!chargeId || !reason) {
        return { error: "Missing required fields" };
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
    if (!dbUser?.stripeCustomerId) {
        return { error: "No billing account found" };
    }

    try {
        // Verify the charge belongs to this customer and is within window
        const charge = await stripeGet<{
            id: string;
            customer: string;
            amount: number;
            created: number;
            refunded: boolean;
            invoice: string | null;
            payment_intent: string | null;
        }>(`/charges/${encodeURIComponent(chargeId)}`);

        if (charge.customer !== dbUser.stripeCustomerId) {
            return { error: "Charge not found" };
        }

        if (charge.refunded) {
            return { error: "This charge has already been refunded" };
        }

        const chargeDate = new Date(charge.created * 1000);
        const windowMs = SELF_SERVICE_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - chargeDate.getTime() > windowMs) {
            return { error: "Self-service refund window has expired. Please submit a refund request." };
        }

        // Calculate mana usage cost
        const { usageCostCents, manaUsed, manaGranted } = await calculateManaUsageCostInternal(user.id);

        // Calculate refund amount (charge minus usage cost)
        const refundAmountCents = Math.max(0, charge.amount - usageCostCents);

        if (refundAmountCents <= 0) {
            return {
                error: `Your mana usage (${manaUsed.toLocaleString()} of ${manaGranted.toLocaleString()} mana) exceeds the charge amount. No refund available.`,
                usageCostCents
            };
        }

        // Process the PARTIAL refund (charge amount minus usage cost)
        const refund = await stripePost<{ id: string; status: string }>("/refunds", new URLSearchParams({
            charge: chargeId,
            amount: refundAmountCents.toString(), // Partial refund
            reason: "requested_by_customer",
        }));

        console.log(`[Refund] User ${user.id}: charged=${charge.amount}c, usage=${usageCostCents}c, refunded=${refundAmountCents}c, manaUsed=${manaUsed}`);

        // Record the refund request (already processed)
        await db.insert(refundRequests).values({
            userId: user.id,
            stripeChargeId: chargeId,
            stripeInvoiceId: charge.invoice,
            stripePaymentIntentId: charge.payment_intent,
            amountCents: refundAmountCents, // Store actual refunded amount
            reason: `${reason} [Usage: ${manaUsed.toLocaleString()} mana = $${(usageCostCents / 100).toFixed(2)}]`,
            status: "approved",
            stripeRefundId: refund.id,
            purchasedAt: chargeDate,
            processedAt: new Date(),
        });

        // IMMEDIATELY cancel subscription and revoke ALL access
        if (charge.invoice) {
            const invoice = await stripeGet<{ subscription: string | null }>(`/invoices/${encodeURIComponent(charge.invoice)}`);
            if (invoice.subscription) {
                // DELETE the subscription immediately (not just cancel at period end)
                try {
                    await stripePost(`/subscriptions/${encodeURIComponent(invoice.subscription)}`, new URLSearchParams({
                        // Setting cancel_at_period_end doesn't delete immediately
                        // We need to use DELETE method, but stripePost doesn't support that
                        // So we cancel immediately by setting proration_behavior
                    }));
                    // Actually delete the subscription via Stripe's cancel endpoint
                    await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(invoice.subscription)}`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    });
                } catch (subErr) {
                    console.error("[Refund] Failed to delete subscription, trying cancel", subErr);
                    // Fallback: at least cancel it
                    await stripePost(`/subscriptions/${encodeURIComponent(invoice.subscription)}`, new URLSearchParams({
                        cancel_at_period_end: "false",
                    }));
                }
            }
        }

        // Also try to cancel by user's stored subscription ID (in case invoice doesn't match)
        if (dbUser.stripeSubscriptionId) {
            try {
                await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(dbUser.stripeSubscriptionId)}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                });
            } catch {
                // Ignore errors - subscription might already be deleted
            }
        }

        // REVOKE ALL ACCESS - Update user record
        await db.update(users).set({
            planId: "wanderer",
            stripeSubscriptionId: null,
            subscriptionPeriodEnd: null,
        }).where(eq(users.id, user.id));

        // Reset wallet - remove subscription mana (keep booster balance - user paid separately for those)
        await db.update(wallets).set({
            manaBalance: 0,
            // Note: boosterBalance is intentionally NOT reset - user paid separately for boosters
            lastCoreGrantAt: null,
        }).where(eq(wallets.userId, user.id));

        // Reset progression flags
        await db.update(progression).set({
            isChanneling: false,
            channelingExpiresAt: null,
        }).where(eq(progression.userId, user.id));

        // Send refund confirmation email
        if (dbUser.email) {
            void sendRefundConfirmationEmail({
                email: dbUser.email,
                refundAmountCents,
                originalAmountCents: charge.amount,
                usageCostCents: usageCostCents > 0 ? usageCostCents : undefined,
                refundType: "subscription",
            });
        }

        // Track analytics
        void trackEvent({
            name: "billing_self_service_refund",
            properties: {
                userId: user.id,
                refundAmountCents,
                originalAmountCents: charge.amount,
                usageCostCents,
                manaUsed,
            },
        });

        return {
            success: true,
            refundedAmountCents: refundAmountCents,
            usageCostCents: usageCostCents,
        };
    } catch (err) {
        console.error("[Refund] Self-service refund failed", err);
        return { error: "Failed to process refund. Please try again or contact support." };
    }
}

/**
 * Request refund (after 7 days) - creates request for admin review
 */
export async function requestRefundAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const user = await requireUser();

    // Rate limit: 3 refund requests per hour
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:request-refund:${user.id}`,
        BILLING_RATE_LIMITS.requestRefund
    );
    if (!rateLimit.success) {
        return { error: "Too many refund requests. Please wait before submitting another." };
    }

    const chargeId = formData.get("chargeId") as string;
    const reason = formData.get("reason") as string;

    if (!chargeId || !reason) {
        return { error: "Missing required fields" };
    }

    if (reason.length < 10) {
        return { error: "Please provide a more detailed reason for your refund request" };
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
    if (!dbUser?.stripeCustomerId) {
        return { error: "No billing account found" };
    }

    try {
        // Verify the charge belongs to this customer
        const charge = await stripeGet<{
            id: string;
            customer: string;
            amount: number;
            created: number;
            refunded: boolean;
            invoice: string | null;
            payment_intent: string | null;
        }>(`/charges/${encodeURIComponent(chargeId)}`);

        if (charge.customer !== dbUser.stripeCustomerId) {
            return { error: "Charge not found" };
        }

        if (charge.refunded) {
            return { error: "This charge has already been refunded" };
        }

        // Check for existing pending request
        const [existingRequest] = await db.select()
            .from(refundRequests)
            .where(and(
                eq(refundRequests.stripeChargeId, chargeId),
                eq(refundRequests.status, "pending")
            ));

        if (existingRequest) {
            return { error: "A refund request for this charge is already pending" };
        }

        // Create the refund request
        await db.insert(refundRequests).values({
            userId: user.id,
            stripeChargeId: chargeId,
            stripeInvoiceId: charge.invoice,
            stripePaymentIntentId: charge.payment_intent,
            amountCents: charge.amount,
            reason,
            status: "pending",
            purchasedAt: new Date(charge.created * 1000),
        });

        // Notify admin about the refund request
        void sendAdminRefundRequestEmail({
            userEmail: dbUser.email ?? "Unknown",
            amountCents: charge.amount,
            reason,
            chargeId,
        });

        // Track analytics
        void trackEvent({
            name: "billing_refund_requested",
            properties: {
                userId: user.id,
                amountCents: charge.amount,
                chargeId,
            },
        });

        return { success: true };
    } catch (err) {
        console.error("[Refund] Failed to create refund request", err);
        return { error: "Failed to submit refund request. Please try again." };
    }
}

/**
 * Get user's refund request history
 */
export async function getRefundRequests() {
    const user = await requireUser();

    const requests = await db.select()
        .from(refundRequests)
        .where(eq(refundRequests.userId, user.id))
        .orderBy(desc(refundRequests.createdAt))
        .limit(10);

    return requests;
}

// --- Booster Refund Actions ---

type BoosterRefundInfo = {
    chargeId: string;
    amountCents: number;
    manaGranted: number;
    manaRemaining: number;
    refundableAmountCents: number;
    purchasedAt: Date;
};

/**
 * Get refundable booster purchases (one-time payments, not subscriptions)
 * Returns booster charges with calculated refund amounts based on remaining balance
 */
export async function getRefundableBoosterPurchases(): Promise<{
    boosters: BoosterRefundInfo[];
    error?: string;
}> {
    const user = await requireUser();
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    if (!dbUser?.stripeCustomerId) {
        return { boosters: [] };
    }

    // Get user's current booster balance
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, user.id));
    const currentBoosterBalance = wallet?.boosterBalance ?? 0;

    try {
        // Get recent charges for this customer (one-time payments only, no invoice = no subscription)
        const charges = await stripeGet<{
            data: Array<{
                id: string;
                amount: number;
                description: string | null;
                created: number;
                refunded: boolean;
                invoice: string | null;
                payment_intent: string | null;
                metadata?: Record<string, string>;
            }>;
        }>(`/charges?customer=${encodeURIComponent(dbUser.stripeCustomerId)}&limit=20`);

        // Filter to only booster purchases (no invoice, positive amount, not refunded)
        // Booster purchases don't have an invoice (they're one-time payments)
        const boosterCharges = charges.data.filter(c =>
            !c.invoice &&
            !c.refunded &&
            c.amount > 0 &&
            (c.description?.toLowerCase().includes('booster') || c.metadata?.boosterAmount)
        );

        // Calculate refundable amounts
        // For simplicity: if user has remaining booster balance, calculate proportional refund
        // from most recent purchases first

        const manaPerDollar = monetizationConfig.mana.usdToMana; // 20,000 mana per $1

        const boosters: BoosterRefundInfo[] = boosterCharges.map(charge => {
            const amountCents = charge.amount;
            const amountDollars = amountCents / 100;
            const manaGranted = amountDollars * manaPerDollar;

            // Assume remaining balance is from most recent purchases
            // Calculate what percentage of this purchase is still available
            const percentRemaining = currentBoosterBalance > 0
                ? Math.min(1, currentBoosterBalance / manaGranted)
                : 0;

            const refundableAmountCents = Math.floor(amountCents * percentRemaining);

            return {
                chargeId: charge.id,
                amountCents,
                manaGranted,
                manaRemaining: Math.floor(manaGranted * percentRemaining),
                refundableAmountCents,
                purchasedAt: new Date(charge.created * 1000),
            };
        });

        return { boosters };
    } catch (err) {
        console.error("[Booster Refund] Failed to fetch booster purchases", err);
        return { boosters: [], error: "Failed to load booster purchases" };
    }
}

/**
 * Request a refund for a booster purchase
 * Refunds proportionally based on remaining booster balance
 */
export async function requestBoosterRefundAction(formData: FormData): Promise<{
    success?: boolean;
    error?: string;
    refundedAmountCents?: number;
    manaDeducted?: number;
}> {
    const user = await requireUser();

    // Rate limit: same as self-service refund (1 per day)
    const rateLimit = await consumeConfiguredRateLimit(
        `billing:booster-refund:${user.id}`,
        BILLING_RATE_LIMITS.selfServiceRefund
    );
    if (!rateLimit.success) {
        return { error: "You can only request one booster refund per day. Please try again tomorrow." };
    }

    const chargeId = formData.get("chargeId") as string;
    const reason = formData.get("reason") as string;

    if (!chargeId || !reason) {
        return { error: "Missing required fields" };
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
    if (!dbUser?.stripeCustomerId) {
        return { error: "No billing account found" };
    }

    // Get wallet
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, user.id));
    if (!wallet) {
        return { error: "No wallet found" };
    }

    if (wallet.boosterBalance <= 0) {
        return { error: "No booster balance to refund. All purchased mana has been used." };
    }

    try {
        // Verify the charge belongs to this customer
        const charge = await stripeGet<{
            id: string;
            customer: string;
            amount: number;
            created: number;
            refunded: boolean;
            invoice: string | null;
            payment_intent: string | null;
        }>(`/charges/${encodeURIComponent(chargeId)}`);

        if (charge.customer !== dbUser.stripeCustomerId) {
            return { error: "Charge not found" };
        }

        if (charge.refunded) {
            return { error: "This charge has already been refunded" };
        }

        // Only allow refund for non-subscription charges (boosters)
        if (charge.invoice) {
            return { error: "This is a subscription charge. Use the subscription refund flow instead." };
        }

        // Calculate refund based on remaining booster balance
        const manaPerDollar = monetizationConfig.mana.usdToMana;
        const chargeAmountDollars = charge.amount / 100;
        const manaFromCharge = chargeAmountDollars * manaPerDollar;

        // Calculate how much of the charge can be refunded based on remaining balance
        const percentRefundable = Math.min(1, wallet.boosterBalance / manaFromCharge);
        const refundAmountCents = Math.floor(charge.amount * percentRefundable);
        const manaToDeduct = Math.floor(manaFromCharge * percentRefundable);

        if (refundAmountCents <= 0) {
            return { error: "No refundable amount. All booster mana from this purchase has been used." };
        }

        // Process the partial refund
        const refund = await stripePost<{ id: string; status: string }>("/refunds", new URLSearchParams({
            charge: chargeId,
            amount: refundAmountCents.toString(),
            reason: "requested_by_customer",
        }));

        console.log(`[Booster Refund] User ${user.id}: charge=${charge.amount}c, refund=${refundAmountCents}c, manaDeducted=${manaToDeduct}`);

        // Record the refund
        await db.insert(refundRequests).values({
            userId: user.id,
            stripeChargeId: chargeId,
            stripePaymentIntentId: charge.payment_intent,
            amountCents: refundAmountCents,
            reason: `[Booster] ${reason}`,
            status: "approved",
            stripeRefundId: refund.id,
            purchasedAt: new Date(charge.created * 1000),
            processedAt: new Date(),
        });

        // Deduct the refunded mana from booster balance
        await db.update(wallets).set({
            boosterBalance: Math.max(0, wallet.boosterBalance - manaToDeduct),
        }).where(eq(wallets.userId, user.id));

        // Send refund confirmation email
        if (dbUser.email) {
            void sendRefundConfirmationEmail({
                email: dbUser.email,
                refundAmountCents,
                originalAmountCents: charge.amount,
                refundType: "booster",
            });
        }

        // Track analytics
        void trackEvent({
            name: "billing_booster_refund",
            properties: {
                userId: user.id,
                refundAmountCents,
                originalAmountCents: charge.amount,
                manaDeducted: manaToDeduct,
            },
        });

        return {
            success: true,
            refundedAmountCents: refundAmountCents,
            manaDeducted: manaToDeduct,
        };
    } catch (err) {
        console.error("[Booster Refund] Failed to process refund", err);
        return { error: "Failed to process booster refund. Please try again or contact support." };
    }
}
