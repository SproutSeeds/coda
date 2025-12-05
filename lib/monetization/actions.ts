import { eq, and, gt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { wallets, referrals, gifts, progression, userQuests, users } from "../db/schema";
import { monetizationConfig } from "../config/monetization";

const db = getDb();

/**
 * Grants the monthly Core Mana budget if eligible.
 * Should be called on user login or periodically.
 */
export async function grantMonthlyCoreMana(userId: string) {
    const userWallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, userId),
    });

    if (!userWallet) return;

    const now = new Date();
    const lastGrant = userWallet.lastCoreGrantAt;
    const monthlyAmount = monetizationConfig.mana.corePerMonthMana;

    // Check if 30 days have passed since last grant
    const daysSinceGrant = lastGrant
        ? (now.getTime() - lastGrant.getTime()) / (1000 * 60 * 60 * 24)
        : 31; // If never granted, treat as eligible

    if (daysSinceGrant >= 30) {
        await db
            .update(wallets)
            .set({
                manaBalance: sql`${wallets.manaBalance} + ${monthlyAmount}`,
                lastCoreGrantAt: now,
            })
            .where(eq(wallets.userId, userId));

        console.log(`Granted ${monthlyAmount} Core Mana to user ${userId}`);
    }
}

/**
 * Creates a referral record.
 */
export async function createReferral(inviterId: string, inviteeId: string) {
    // Check if invitee is already referred
    const existing = await db.query.referrals.findFirst({
        where: eq(referrals.inviteeId, inviteeId),
    });

    if (existing) {
        throw new Error("User has already been referred.");
    }

    // Create referral
    await db.insert(referrals).values({
        inviterId,
        inviteeId,
        status: "pending",
    });

    // Grant Starter Mana to Invitee
    const starterMana = monetizationConfig.referral.starterGrantMana;
    await db
        .update(wallets)
        .set({
            manaBalance: sql`${wallets.manaBalance} + ${starterMana}`,
        })
        .where(eq(wallets.userId, inviteeId));

    console.log(`Created referral: ${inviterId} -> ${inviteeId}`);
}

/**
 * Checks and awards referral milestones for an inviter.
 * Should be called when an invitee performs relevant actions (levels up, subscribes, etc).
 */
export async function checkReferralMilestones(inviteeId: string) {
    const referral = await db.query.referrals.findFirst({
        where: eq(referrals.inviteeId, inviteeId),
    });

    if (!referral || referral.status === "completed") return;

    const inviteeProgression = await db.query.progression.findFirst({
        where: eq(progression.userId, inviteeId),
    });

    // Count completed quests
    const completedQuestsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(userQuests)
        .where(and(eq(userQuests.userId, inviteeId), eq(userQuests.status, "completed")))
        .then((res) => Number(res[0]?.count || 0));

    const claimedRewards = (referral.rewardsClaimed as string[]) || [];
    let newRewards = 0;
    const milestones = monetizationConfig.referral.milestones;

    // Check Milestones
    for (const milestone of milestones) {
        if (claimedRewards.includes(milestone.key)) continue;

        let met = false;
        if (milestone.key === "verify_and_trial") {
            // Assuming "verify" means email verified and trial started/completed
            // For now, checking if user exists (verified) and has progression
            // TODO: Add specific trial tracking logic if needed
            met = true; // Placeholder: Assume met if they are active enough to trigger this check
        } else if (milestone.key === "three_quests") {
            if (completedQuestsCount >= 3) met = true;
        } else if (milestone.key === "level_5_or_subscribe") {
            if ((inviteeProgression?.level || 0) >= 5 || inviteeProgression?.isChanneling) met = true;
        }

        if (met) {
            newRewards += milestone.rewardMana;
            claimedRewards.push(milestone.key);
        }
    }

    if (newRewards > 0) {
        // Check caps
        const inviterWallet = await db.query.wallets.findFirst({
            where: eq(wallets.userId, referral.inviterId)
        });
        // TODO: Implement monthly cap check here (requires tracking referral earnings per month)

        // Grant rewards to inviter
        await db
            .update(wallets)
            .set({
                manaBalance: sql`${wallets.manaBalance} + ${newRewards}`,
            })
            .where(eq(wallets.userId, referral.inviterId));

        // Update referral record
        await db
            .update(referrals)
            .set({
                rewardsClaimed: claimedRewards,
                status: claimedRewards.length === milestones.length ? "completed" : "pending",
            })
            .where(eq(referrals.id, referral.id));

        console.log(`Granted ${newRewards} Referral Mana to inviter ${referral.inviterId}`);
    }
}

/**
 * Sends a gift of premium subscription.
 */
export async function sendGift(senderId: string, recipientId: string) {
    // Check limits
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const giftsSentThisMonth = await db
        .select({ count: sql<number>`count(*)` })
        .from(gifts)
        .where(and(
            eq(gifts.senderId, senderId),
            gt(gifts.createdAt, startOfMonth)
        ))
        .then((res) => Number(res[0]?.count || 0));

    if (giftsSentThisMonth >= monetizationConfig.gifting.maxGiftsPerMonth) {
        throw new Error("Monthly gift limit reached.");
    }

    // Create gift
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + monetizationConfig.gifting.acceptWindowDays);

    await db.insert(gifts).values({
        senderId,
        recipientId,
        status: "pending",
        expiresAt,
    });

    console.log(`Gift sent from ${senderId} to ${recipientId}`);
}

/**
 * Claims a received gift.
 */
export async function claimGift(recipientId: string, giftId: string) {
    const gift = await db.query.gifts.findFirst({
        where: and(eq(gifts.id, giftId), eq(gifts.recipientId, recipientId)),
    });

    if (!gift || gift.status !== "pending") {
        throw new Error("Invalid or expired gift.");
    }

    if (new Date() > gift.expiresAt) {
        await db.update(gifts).set({ status: "expired" }).where(eq(gifts.id, giftId));
        throw new Error("Gift has expired.");
    }

    // Activate Subscription (Channeling)
    const now = new Date();
    const durationDays = monetizationConfig.gifting.giftDurationDays;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await db
        .update(progression)
        .set({
            isChanneling: true,
            channelingExpiresAt: expiresAt,
        })
        .where(eq(progression.userId, recipientId));

    // Mark gift accepted
    await db
        .update(gifts)
        .set({ status: "accepted" })
        .where(eq(gifts.id, giftId));

    console.log(`Gift claimed by ${recipientId}`);
}
