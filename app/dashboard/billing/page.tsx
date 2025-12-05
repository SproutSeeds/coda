import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { wallets, referrals, gifts, users } from "@/lib/db/schema";
import { progression } from "@/lib/db/schema/monetization";
import { monetizationConfig } from "@/lib/config/monetization";
import { getRefundableCharges, getRefundRequests } from "./actions";
import { stripeGet } from "@/lib/stripe/http";
import { stripeEnv } from "@/lib/stripe/config";
import { listSubscriptionSchedules } from "@/lib/stripe/subscriptions";
import { BillingClient } from "./billing-client";

const db = getDb();

export default async function BillingPage() {
    // These params will be handled by the client component notification system if needed,
    // or we can pass them as props. For now, we focus on the data.

    const user = await requireUser();

    // Fetch Wallet
    const userWallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, user.id),
    });

    let dbUser: {
        stripeSubscriptionId?: string | null;
        planId?: string | null;
        subscriptionPeriodEnd?: Date | null;
        stripeCustomerId?: string | null;
        trialEndsAt?: Date | null;
        chosenPath?: string | null;
        createdAt?: Date | null;
    } | null = null;

    try {
        const foundUser = await db.query.users.findFirst({
            where: eq(users.id, user.id),
        });
        dbUser = foundUser ?? null;
    } catch (err) {
        console.error("[Billing] Unable to load user billing fields (plan/subscription); treating as wanderer.", err);
    }

    // Fetch progression (channeling flag as fallback)
    const userProgress = await db.query.progression.findFirst({
        where: eq(progression.userId, user.id),
    });

    // Fetch Referrals
    const userReferrals = await db.query.referrals.findMany({
        where: eq(referrals.inviterId, user.id),
        with: {
            invitee: true 
        },
        orderBy: desc(referrals.createdAt),
        limit: 5,
    });

    // Fetch Gifts (Sent & Received)
    const sentGifts = await db.query.gifts.findMany({
        where: eq(gifts.senderId, user.id),
        orderBy: desc(gifts.createdAt),
        limit: 5,
    });

    const receivedGifts = await db.query.gifts.findMany({
        where: eq(gifts.recipientId, user.id),
        orderBy: desc(gifts.createdAt),
        limit: 5,
    });

    // Fallback: read subscription directly from Stripe for a single source of truth
    let remoteSub: {
        id: string;
        priceId: string | null;
        cancelAtPeriodEnd: boolean;
        cancelAt: Date | null;
        periodEnd: Date | null;
        periodStart: Date | null;
        status: string | null;
    } | null = null;

    let scheduledAnnualStart: Date | null = null;
    let scheduledAnnualEnd: Date | null = null;
    let schedulePhaseStart: Date | null = null;
    let schedulePhaseEnd: Date | null = null;

    try {
        if (dbUser?.stripeSubscriptionId) {
            const sub = await stripeGet<{
                id: string;
                status: string;
                cancel_at_period_end: boolean;
                cancel_at?: number | null;
                current_period_end?: number | null;
                current_period_start?: number | null;
                items: { data: Array<{
                    price: { id: string | null } | null;
                    current_period_end?: number | null;
                    current_period_start?: number | null;
                }> };
            }>(`/subscriptions/${encodeURIComponent(dbUser.stripeSubscriptionId)}`);

            const itemPeriodEnd = sub.items?.data?.[0]?.current_period_end;
            const itemPeriodStart = sub.items?.data?.[0]?.current_period_start;
            const periodEnd = itemPeriodEnd ?? sub.current_period_end;
            const periodStart = itemPeriodStart ?? sub.current_period_start;

            remoteSub = {
                id: sub.id,
                priceId: sub.items?.data?.[0]?.price?.id ?? null,
                cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
                cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
                periodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
                periodStart: periodStart ? new Date(periodStart * 1000) : null,
                status: sub.status ?? null,
            };
        }

        if (dbUser?.stripeCustomerId && (!remoteSub || !remoteSub.periodEnd || !remoteSub.periodStart)) {
            const subs = await stripeGet<{
                data: Array<{
                    id: string;
                    status: string;
                    cancel_at_period_end: boolean;
                    cancel_at?: number | null;
                    current_period_end?: number | null;
                    current_period_start?: number | null;
                    items: { data: Array<{
                        price: { id: string | null } | null;
                        current_period_end?: number | null;
                        current_period_start?: number | null;
                    }> };
                }>;
            }>(`/subscriptions?customer=${encodeURIComponent(dbUser.stripeCustomerId)}&status=all&limit=10`);

            const getPeriodEnd = (s: typeof subs.data[0]) => s.items?.data?.[0]?.current_period_end ?? s.current_period_end;
            const getPeriodStart = (s: typeof subs.data[0]) => s.items?.data?.[0]?.current_period_start ?? s.current_period_start;

            const withDates = subs.data
                .filter((s) => !!getPeriodEnd(s))
                .sort((a, b) => (getPeriodEnd(b) || 0) - (getPeriodEnd(a) || 0));

            const pick =
                subs.data.find((s) => (s.status === "active" || s.status === "trialing") && getPeriodEnd(s)) ??
                withDates[0];

            if (pick) {
                const pickPeriodEnd = getPeriodEnd(pick);
                const pickPeriodStart = getPeriodStart(pick);

                remoteSub = {
                    id: pick.id,
                    priceId: pick.items?.data?.[0]?.price?.id ?? remoteSub?.priceId ?? null,
                    cancelAtPeriodEnd: Boolean(pick.cancel_at_period_end),
                    cancelAt: pick.cancel_at ? new Date(pick.cancel_at * 1000) : remoteSub?.cancelAt ?? null,
                    periodEnd: pickPeriodEnd ? new Date(pickPeriodEnd * 1000) : remoteSub?.periodEnd ?? null,
                    periodStart: pickPeriodStart ? new Date(pickPeriodStart * 1000) : remoteSub?.periodStart ?? null,
                    status: pick.status ?? remoteSub?.status ?? null,
                };
            }
        }

        if (dbUser?.stripeCustomerId) {
            const schedules = await listSubscriptionSchedules({ customerId: dbUser.stripeCustomerId });
            const upgradeSchedule = schedules.data.find((s) =>
                (s.status === "not_started" || s.status === "active") &&
                s.phases.some((p) => p.items.some((i) => i.price === stripeEnv.prices.sorcererAnnual))
            );
            if (upgradeSchedule) {
                const annualPhase = upgradeSchedule.phases.find((p) =>
                    p.items.some((i) => i.price === stripeEnv.prices.sorcererAnnual)
                );
                if (annualPhase) {
                    scheduledAnnualStart = new Date(annualPhase.start_date * 1000);
                    scheduledAnnualEnd = new Date(annualPhase.end_date * 1000);
                    const now = Date.now();
                    if (annualPhase.start_date * 1000 <= now && annualPhase.end_date * 1000 >= now) {
                        schedulePhaseStart = new Date(annualPhase.start_date * 1000);
                        schedulePhaseEnd = new Date(annualPhase.end_date * 1000);
                    }
                }
            }
        }
    } catch (err) {
        console.error("[Billing] Unable to read remote Stripe subscription/schedules", err);
    }

    if (remoteSub?.periodEnd && dbUser) {
        const stored = dbUser.subscriptionPeriodEnd ? dbUser.subscriptionPeriodEnd.getTime() : null;
        if (stored !== remoteSub.periodEnd.getTime()) {
            await db.update(users).set({
                subscriptionPeriodEnd: remoteSub.periodEnd,
            }).where(eq(users.id, user.id));
            dbUser = { ...dbUser, subscriptionPeriodEnd: remoteSub.periodEnd };
        }
    }

    const priceToVariant = (priceId: string | null | undefined) => {
        if (!priceId) return null;
        if (priceId === stripeEnv.prices.sorcererAnnual) return "annual" as const;
        if (priceId === stripeEnv.prices.sorcererMonthly) return "monthly" as const;
        return null;
    };

    const planVariantLocal =
        dbUser?.planId === "sorcerer_annual"
            ? "annual"
            : dbUser?.planId === "sorcerer_monthly" || dbUser?.planId === "sorcerer"
            ? "monthly"
            : null;
    const planVariantRemote = priceToVariant(remoteSub?.priceId);
    const planVariant = planVariantLocal ?? planVariantRemote;

    const remoteActive = remoteSub && (remoteSub.status === "active" || remoteSub.status === "trialing");
    const localActive =
        Boolean(dbUser?.stripeSubscriptionId) ||
        Boolean(planVariantLocal) ||
        Boolean(userProgress?.isChanneling);

    const isSorcerer = Boolean(localActive || remoteActive);

    const planLabel =
        planVariant === "annual" ? "$240/yr (Annual Pact)" : planVariant === "monthly" ? "$25/mo (Monthly Pact)" : null;

    const derivedPeriodStart = remoteSub?.periodStart ?? schedulePhaseStart ?? scheduledAnnualStart ?? null;
    const derivedPeriodEnd = remoteSub?.periodEnd ?? schedulePhaseEnd ?? scheduledAnnualEnd ?? dbUser?.subscriptionPeriodEnd ?? null;
    const renewalDate = derivedPeriodEnd;

    const scheduledCancellation: Date | null = (() => {
        if (remoteSub?.cancelAt) {
            return remoteSub.cancelAt;
        }
        if (remoteSub?.cancelAtPeriodEnd) {
            return remoteSub.periodEnd ?? dbUser?.subscriptionPeriodEnd ?? null;
        }
        if (userProgress?.channelingExpiresAt) {
            return new Date(userProgress.channelingExpiresAt);
        }
        return null;
    })();

    // Fetch refund data
    const [refundChargesResult, refundRequestsResult] = await Promise.all([
        getRefundableCharges(),
        getRefundRequests(),
    ]);

    return (
        <BillingClient 
            user={user}
            wallet={{
                manaBalance: userWallet?.manaBalance || 0,
                boosterBalance: userWallet?.boosterBalance || 0,
            }}
            subscription={{
                isSorcerer,
                status: remoteSub?.status ?? null,
                planVariant,
                planLabel,
                periodStart: derivedPeriodStart,
                periodEnd: derivedPeriodEnd,
                renewalDate,
                scheduledCancellation,
                scheduledAnnualStart,
                scheduledAnnualEnd
            }}
            referrals={userReferrals}
            gifts={{
                sent: sentGifts,
                received: receivedGifts
            }}
            refunds={{
                charges: refundChargesResult.charges,
                requests: refundRequestsResult.map(r => ({
                    id: r.id,
                    status: r.status,
                    amountCents: r.amountCents,
                    reason: r.reason,
                    createdAt: r.createdAt,
                    processedAt: r.processedAt,
                    adminNotes: r.adminNotes,
                })),
            }}
            monetizationConfig={monetizationConfig}
        />
    );
}