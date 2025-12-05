/**
 * Trial Provisioning
 *
 * Handles starting and managing gauntlet trials for new users.
 * Called when a user first signs up or chooses to start the free trial.
 */

import { getDb } from "@/lib/db";
import { users, gauntlet, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PLAN_IDS, GAUNTLET, QUESTS, QUEST_IDS } from "./constants";

// =============================================================================
// Types
// =============================================================================

export interface ProvisionTrialResult {
  success: boolean;
  trialExpiresAt: Date;
  baseDays: number;
  error?: string;
}

export interface ProvisionSubscriptionResult {
  success: boolean;
  planId: string;
  error?: string;
}

// =============================================================================
// Trial Provisioning
// =============================================================================

/**
 * Start a new gauntlet trial for a user.
 * Called when user signs up or explicitly chooses the free trial path.
 */
export async function provisionTrial(userId: string): Promise<ProvisionTrialResult> {
  const db = getDb();

  try {
    // Check if user already has a gauntlet record
    const existing = await db
      .select()
      .from(gauntlet)
      .where(eq(gauntlet.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // User already has a gauntlet - return current state
      const g = existing[0];
      return {
        success: true,
        trialExpiresAt: g.trialExpiresAt,
        baseDays: g.baseDays,
      };
    }

    // Calculate initial trial expiration
    const now = new Date();
    const trialExpiresAt = new Date(now.getTime() + GAUNTLET.baseDays * 24 * 60 * 60 * 1000);

    // Create gauntlet record
    await db.insert(gauntlet).values({
      userId,
      status: "active",
      baseDays: GAUNTLET.baseDays,
      earnedDays: 0,
      restDaysUsed: 0,
      maxRestDays: GAUNTLET.maxRestDays,
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      startedAt: now,
      trialExpiresAt,
      rewardsClaimed: false,
    });

    // Update user plan to wanderer (free tier)
    await db
      .update(users)
      .set({ planId: PLAN_IDS.WANDERER })
      .where(eq(users.id, userId));

    // Ensure user has a wallet (for quest rewards)
    await db
      .insert(wallets)
      .values({
        userId,
        manaBalance: QUESTS[QUEST_IDS.FIRST_IDEA].manaReward, // Start with first-idea bonus potential
        boosterBalance: 0,
        maxMana: 100,
        manaRegenRate: 1,
      })
      .onConflictDoNothing();

    return {
      success: true,
      trialExpiresAt,
      baseDays: GAUNTLET.baseDays,
    };
  } catch (error) {
    console.error("[Provision] Failed to provision trial:", error);
    return {
      success: false,
      trialExpiresAt: new Date(),
      baseDays: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Extend a user's trial by adding earned days.
 * Called when a quest is completed that grants trial days.
 */
export async function extendTrial(
  userId: string,
  daysToAdd: number
): Promise<{ success: boolean; newExpiresAt: Date | null; error?: string }> {
  const db = getDb();

  try {
    // Get current gauntlet state
    const [current] = await db
      .select()
      .from(gauntlet)
      .where(eq(gauntlet.userId, userId))
      .limit(1);

    if (!current) {
      return { success: false, newExpiresAt: null, error: "No active trial" };
    }

    if (current.status !== "active") {
      return { success: false, newExpiresAt: null, error: `Trial is ${current.status}` };
    }

    // Calculate new expiration (but don't exceed max days)
    const totalDays = current.baseDays + current.earnedDays + daysToAdd;
    const cappedTotalDays = Math.min(totalDays, GAUNTLET.maxDays);
    const actualDaysAdded = cappedTotalDays - (current.baseDays + current.earnedDays);

    if (actualDaysAdded <= 0) {
      // Already at max
      return { success: true, newExpiresAt: current.trialExpiresAt };
    }

    // Calculate new expiration date
    const newEarnedDays = current.earnedDays + actualDaysAdded;
    const newExpiresAt = new Date(
      current.startedAt.getTime() + (current.baseDays + newEarnedDays) * 24 * 60 * 60 * 1000
    );

    // Update gauntlet
    await db
      .update(gauntlet)
      .set({
        earnedDays: newEarnedDays,
        trialExpiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(gauntlet.userId, userId));

    return { success: true, newExpiresAt };
  } catch (error) {
    console.error("[Provision] Failed to extend trial:", error);
    return {
      success: false,
      newExpiresAt: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Subscription Provisioning
// =============================================================================

/**
 * Provision a paid subscription for a user.
 * Called after successful Stripe payment.
 * If user was in gauntlet, marks it as "converted" (they can still complete for rewards).
 */
export async function provisionSubscription(
  userId: string,
  planId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  periodEnd: Date
): Promise<ProvisionSubscriptionResult> {
  const db = getDb();

  try {
    // Update user with subscription details
    await db
      .update(users)
      .set({
        planId,
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionPeriodEnd: periodEnd,
      })
      .where(eq(users.id, userId));

    // Check if user has an active gauntlet
    const [currentGauntlet] = await db
      .select()
      .from(gauntlet)
      .where(eq(gauntlet.userId, userId))
      .limit(1);

    if (currentGauntlet && currentGauntlet.status === "active") {
      // Mark gauntlet as converted - they can still complete it for rewards
      await db
        .update(gauntlet)
        .set({
          status: "converted",
          convertedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(gauntlet.userId, userId));
    }

    return { success: true, planId };
  } catch (error) {
    console.error("[Provision] Failed to provision subscription:", error);
    return {
      success: false,
      planId: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Deprovision a subscription (called on cancellation).
 * If gauntlet was "converted", consider reverting to "active" if still within trial period.
 */
export async function deprovisionSubscription(userId: string): Promise<{ success: boolean }> {
  const db = getDb();

  try {
    // Clear subscription details but keep planId as wanderer
    await db
      .update(users)
      .set({
        planId: PLAN_IDS.WANDERER,
        stripeSubscriptionId: null,
        subscriptionPeriodEnd: null,
        // Keep stripeCustomerId for potential resubscription
      })
      .where(eq(users.id, userId));

    // Check gauntlet status
    const [currentGauntlet] = await db
      .select()
      .from(gauntlet)
      .where(eq(gauntlet.userId, userId))
      .limit(1);

    if (currentGauntlet?.status === "converted") {
      // Check if trial period is still valid
      const now = new Date();
      if (currentGauntlet.trialExpiresAt > now) {
        // Revert to active trial
        await db
          .update(gauntlet)
          .set({
            status: "active",
            convertedAt: null,
            updatedAt: now,
          })
          .where(eq(gauntlet.userId, userId));
      } else {
        // Trial would have expired - mark as failed
        await db
          .update(gauntlet)
          .set({
            status: "failed",
            failedAt: now,
            updatedAt: now,
          })
          .where(eq(gauntlet.userId, userId));
      }
    }

    return { success: true };
  } catch (error) {
    console.error("[Provision] Failed to deprovision subscription:", error);
    return { success: false };
  }
}

// =============================================================================
// Gauntlet Status Updates
// =============================================================================

/**
 * Mark gauntlet as completed (user survived all 30 days).
 */
export async function completeGauntlet(userId: string): Promise<{ success: boolean }> {
  const db = getDb();

  try {
    const now = new Date();
    await db
      .update(gauntlet)
      .set({
        status: "completed",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(gauntlet.userId, userId));

    return { success: true };
  } catch (error) {
    console.error("[Provision] Failed to complete gauntlet:", error);
    return { success: false };
  }
}

/**
 * Mark gauntlet as failed (ran out of rest days or trial expired).
 */
export async function failGauntlet(userId: string): Promise<{ success: boolean }> {
  const db = getDb();

  try {
    const now = new Date();
    await db
      .update(gauntlet)
      .set({
        status: "failed",
        failedAt: now,
        updatedAt: now,
      })
      .where(eq(gauntlet.userId, userId));

    return { success: true };
  } catch (error) {
    console.error("[Provision] Failed to fail gauntlet:", error);
    return { success: false };
  }
}
