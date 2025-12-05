/**
 * Gauntlet Progression Logic
 *
 * Handles quest completion, streak tracking, and reward claiming for the 30-day gauntlet challenge.
 */

import { getDb } from "@/lib/db";
import { gauntlet, gauntletQuestCompletions, gauntletRewards, wallets } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { QUESTS, GAUNTLET, GAUNTLET_REWARDS, type QuestId, type QuestDefinition } from "./constants";
import { extendTrial, completeGauntlet as markGauntletComplete } from "./provision";

// =============================================================================
// Types
// =============================================================================

export interface QuestCompletionResult {
  success: boolean;
  alreadyCompleted?: boolean;
  onCooldown?: boolean;
  cooldownEndsAt?: Date;
  rewards?: {
    trialDays: number;
    mana: number;
    xp: number;
  };
  newTrialExpiresAt?: Date;
  error?: string;
}

export interface GauntletState {
  status: "active" | "completed" | "failed" | "converted" | null;
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  earnedDays: number;
  trialExpiresAt: Date | null;
  daysRemaining: number;
  completedQuests: string[];
  availableQuests: QuestDefinition[];
  rewardsClaimed: boolean;
}

export interface ClaimRewardsResult {
  success: boolean;
  rewards?: {
    title: string;
    bonusMana: number;
    discountPercent: number;
    cosmetics: Array<{ id: string; name: string; type: string }>;
  };
  error?: string;
}

// =============================================================================
// Quest Completion
// =============================================================================

/**
 * Complete a quest and grant rewards.
 * Handles cooldowns for repeatable quests and one-time milestone quests.
 */
export async function completeQuest(
  userId: string,
  questId: QuestId
): Promise<QuestCompletionResult> {
  const db = getDb();
  const quest = QUESTS[questId];

  if (!quest) {
    return { success: false, error: "Unknown quest" };
  }

  try {
    // Check if user has an active gauntlet
    const [userGauntlet] = await db
      .select()
      .from(gauntlet)
      .where(eq(gauntlet.userId, userId))
      .limit(1);

    if (!userGauntlet) {
      return { success: false, error: "No active gauntlet" };
    }

    if (userGauntlet.status === "failed") {
      return { success: false, error: "Gauntlet has failed" };
    }

    // Check for existing completions
    const existingCompletions = await db
      .select()
      .from(gauntletQuestCompletions)
      .where(
        and(
          eq(gauntletQuestCompletions.userId, userId),
          eq(gauntletQuestCompletions.questId, questId)
        )
      )
      .orderBy(desc(gauntletQuestCompletions.completedAt))
      .limit(1);

    const lastCompletion = existingCompletions[0];

    // Handle milestone (one-time) quests
    if (quest.isMilestone && lastCompletion) {
      return { success: false, alreadyCompleted: true };
    }

    // Handle repeatable quests with cooldown
    if (quest.repeatable && lastCompletion) {
      const now = new Date();
      if (lastCompletion.cooldownEndsAt && lastCompletion.cooldownEndsAt > now) {
        return {
          success: false,
          onCooldown: true,
          cooldownEndsAt: lastCompletion.cooldownEndsAt,
        };
      }
    }

    // Calculate cooldown for repeatable quests
    const now = new Date();
    let cooldownEndsAt: Date | null = null;
    if (quest.repeatable && quest.cooldownHours) {
      cooldownEndsAt = new Date(now.getTime() + quest.cooldownHours * 60 * 60 * 1000);
    }

    // Record the completion
    await db.insert(gauntletQuestCompletions).values({
      userId,
      questId,
      trialDaysGranted: Math.round(quest.trialDaysReward * 10), // Store as 10ths for precision
      manaGranted: quest.manaReward,
      xpGranted: quest.xpReward,
      completedAt: now,
      cooldownEndsAt,
    });

    // Grant mana reward if any
    if (quest.manaReward > 0) {
      await db
        .update(wallets)
        .set({
          manaBalance: wallets.manaBalance,
          updatedAt: now,
        })
        .where(eq(wallets.userId, userId));

      // Use raw SQL for atomic increment
      await db.execute(
        `UPDATE wallets SET mana_balance = mana_balance + ${quest.manaReward} WHERE user_id = '${userId}'`
      );
    }

    // Extend trial if applicable (for free users)
    let newTrialExpiresAt: Date | null = null;
    if (quest.trialDaysReward > 0 && userGauntlet.status === "active") {
      const extendResult = await extendTrial(userId, quest.trialDaysReward);
      if (extendResult.success) {
        newTrialExpiresAt = extendResult.newExpiresAt;
      }
    }

    // Update streak and activity
    await updateGauntletActivity(userId, now);

    // Check for gauntlet completion
    await checkGauntletCompletion(userId);

    return {
      success: true,
      rewards: {
        trialDays: quest.trialDaysReward,
        mana: quest.manaReward,
        xp: quest.xpReward,
      },
      newTrialExpiresAt: newTrialExpiresAt ?? undefined,
    };
  } catch (error) {
    console.error("[Gauntlet] Failed to complete quest:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update gauntlet activity tracking (streak, active days)
 */
async function updateGauntletActivity(userId: string, activityTime: Date): Promise<void> {
  const db = getDb();

  const [current] = await db
    .select()
    .from(gauntlet)
    .where(eq(gauntlet.userId, userId))
    .limit(1);

  if (!current) return;

  // Check if this is a new day of activity
  const lastActivity = current.lastActivityAt;
  const isNewDay =
    !lastActivity ||
    activityTime.toDateString() !== lastActivity.toDateString();

  if (isNewDay) {
    // Check if streak continues (activity within last 48 hours to allow some flexibility)
    const streakWindow = 48 * 60 * 60 * 1000; // 48 hours
    const streakContinues =
      lastActivity && activityTime.getTime() - lastActivity.getTime() < streakWindow;

    const newStreak = streakContinues ? current.currentStreak + 1 : 1;
    const newLongest = Math.max(current.longestStreak, newStreak);

    await db
      .update(gauntlet)
      .set({
        currentStreak: newStreak,
        longestStreak: newLongest,
        totalActiveDays: current.totalActiveDays + 1,
        lastActivityAt: activityTime,
        updatedAt: activityTime,
      })
      .where(eq(gauntlet.userId, userId));
  } else {
    // Same day, just update last activity
    await db
      .update(gauntlet)
      .set({
        lastActivityAt: activityTime,
        updatedAt: activityTime,
      })
      .where(eq(gauntlet.userId, userId));
  }
}

/**
 * Check if gauntlet is complete (30 active days)
 */
async function checkGauntletCompletion(userId: string): Promise<void> {
  const db = getDb();

  const [current] = await db
    .select()
    .from(gauntlet)
    .where(eq(gauntlet.userId, userId))
    .limit(1);

  if (!current) return;

  // Complete if user has reached 30 active days
  if (
    current.totalActiveDays >= GAUNTLET.completionDays &&
    current.status !== "completed"
  ) {
    await markGauntletComplete(userId);
  }
}

// =============================================================================
// Gauntlet State
// =============================================================================

/**
 * Get current gauntlet state for a user
 */
export async function getGauntletState(userId: string): Promise<GauntletState> {
  const db = getDb();

  const [userGauntlet] = await db
    .select()
    .from(gauntlet)
    .where(eq(gauntlet.userId, userId))
    .limit(1);

  if (!userGauntlet) {
    return {
      status: null,
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      earnedDays: 0,
      trialExpiresAt: null,
      daysRemaining: 0,
      completedQuests: [],
      availableQuests: [],
      rewardsClaimed: false,
    };
  }

  // Get completed quests
  const completions = await db
    .select({ questId: gauntletQuestCompletions.questId })
    .from(gauntletQuestCompletions)
    .where(eq(gauntletQuestCompletions.userId, userId));

  const completedQuestIds = [...new Set(completions.map((c) => c.questId))];

  // Calculate days remaining
  const now = new Date();
  let daysRemaining = 0;
  if (userGauntlet.trialExpiresAt > now) {
    const msRemaining = userGauntlet.trialExpiresAt.getTime() - now.getTime();
    daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  }

  // Determine available quests (not completed milestones, or repeatable quests off cooldown)
  const availableQuests = Object.values(QUESTS).filter((quest) => {
    if (quest.isMilestone) {
      return !completedQuestIds.includes(quest.id);
    }
    // For repeatable quests, they're always "available" (cooldown is handled at completion time)
    return true;
  });

  return {
    status: userGauntlet.status,
    currentStreak: userGauntlet.currentStreak,
    longestStreak: userGauntlet.longestStreak,
    totalActiveDays: userGauntlet.totalActiveDays,
    earnedDays: userGauntlet.earnedDays,
    trialExpiresAt: userGauntlet.trialExpiresAt,
    daysRemaining,
    completedQuests: completedQuestIds,
    availableQuests,
    rewardsClaimed: userGauntlet.rewardsClaimed,
  };
}

/**
 * Get available quests for user with cooldown status
 */
export async function getAvailableQuests(
  userId: string
): Promise<Array<QuestDefinition & { available: boolean; cooldownEndsAt?: Date }>> {
  const db = getDb();
  const now = new Date();

  // Get all recent completions
  const completions = await db
    .select()
    .from(gauntletQuestCompletions)
    .where(eq(gauntletQuestCompletions.userId, userId))
    .orderBy(desc(gauntletQuestCompletions.completedAt));

  // Build a map of quest -> last completion
  const lastCompletionMap = new Map<string, typeof completions[0]>();
  for (const c of completions) {
    if (!lastCompletionMap.has(c.questId)) {
      lastCompletionMap.set(c.questId, c);
    }
  }

  return Object.values(QUESTS).map((quest) => {
    const lastCompletion = lastCompletionMap.get(quest.id);

    if (quest.isMilestone) {
      // Milestone quests are one-time
      return {
        ...quest,
        available: !lastCompletion,
      };
    }

    // Repeatable quests check cooldown
    if (lastCompletion?.cooldownEndsAt && lastCompletion.cooldownEndsAt > now) {
      return {
        ...quest,
        available: false,
        cooldownEndsAt: lastCompletion.cooldownEndsAt,
      };
    }

    return { ...quest, available: true };
  });
}

// =============================================================================
// Reward Claiming
// =============================================================================

/**
 * Claim gauntlet completion rewards
 */
export async function claimGauntletRewards(userId: string): Promise<ClaimRewardsResult> {
  const db = getDb();

  try {
    // Check gauntlet status
    const [userGauntlet] = await db
      .select()
      .from(gauntlet)
      .where(eq(gauntlet.userId, userId))
      .limit(1);

    if (!userGauntlet) {
      return { success: false, error: "No gauntlet found" };
    }

    if (userGauntlet.status !== "completed") {
      return { success: false, error: "Gauntlet not completed" };
    }

    if (userGauntlet.rewardsClaimed) {
      return { success: false, error: "Rewards already claimed" };
    }

    const now = new Date();

    // Grant bonus mana
    await db.execute(
      `UPDATE wallets SET mana_balance = mana_balance + ${GAUNTLET_REWARDS.bonusMana} WHERE user_id = '${userId}'`
    );

    // Create reward records
    const rewardRecords = [
      // Title
      {
        userId,
        rewardId: "gauntlet_survivor_title",
        rewardType: "title",
        earnedAt: now,
      },
      // First month discount
      {
        userId,
        rewardId: "first_month_discount",
        rewardType: "discount",
        discountPercent: GAUNTLET_REWARDS.firstMonthDiscountPercent,
        discountUsed: false,
        earnedAt: now,
      },
      // Cosmetics
      ...GAUNTLET_REWARDS.cosmetics.map((cosmetic) => ({
        userId,
        rewardId: cosmetic.id,
        rewardType: cosmetic.type,
        earnedAt: now,
      })),
    ];

    for (const reward of rewardRecords) {
      await db.insert(gauntletRewards).values(reward).onConflictDoNothing();
    }

    // Mark rewards as claimed
    await db
      .update(gauntlet)
      .set({
        rewardsClaimed: true,
        rewardsClaimedAt: now,
        updatedAt: now,
      })
      .where(eq(gauntlet.userId, userId));

    return {
      success: true,
      rewards: {
        title: GAUNTLET_REWARDS.title,
        bonusMana: GAUNTLET_REWARDS.bonusMana,
        discountPercent: GAUNTLET_REWARDS.firstMonthDiscountPercent,
        cosmetics: GAUNTLET_REWARDS.cosmetics.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        })),
      },
    };
  } catch (error) {
    console.error("[Gauntlet] Failed to claim rewards:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if user has unclaimed gauntlet discount
 */
export async function getUnclaimedDiscount(
  userId: string
): Promise<{ hasDiscount: boolean; discountPercent: number }> {
  const db = getDb();

  const [discount] = await db
    .select()
    .from(gauntletRewards)
    .where(
      and(
        eq(gauntletRewards.userId, userId),
        eq(gauntletRewards.rewardType, "discount"),
        eq(gauntletRewards.discountUsed, false)
      )
    )
    .limit(1);

  if (!discount) {
    return { hasDiscount: false, discountPercent: 0 };
  }

  return {
    hasDiscount: true,
    discountPercent: discount.discountPercent ?? 0,
  };
}

/**
 * Mark discount as used (called after successful subscription)
 */
export async function useGauntletDiscount(userId: string): Promise<{ success: boolean }> {
  const db = getDb();

  try {
    await db
      .update(gauntletRewards)
      .set({
        discountUsed: true,
        discountUsedAt: new Date(),
      })
      .where(
        and(
          eq(gauntletRewards.userId, userId),
          eq(gauntletRewards.rewardType, "discount"),
          eq(gauntletRewards.discountUsed, false)
        )
      );

    return { success: true };
  } catch {
    return { success: false };
  }
}

// =============================================================================
// Daily Check (for cron job)
// =============================================================================

/**
 * Process daily gauntlet updates.
 * Called by cron job to:
 * - Check for streak breaks (increment rest days)
 * - Fail gauntlets that exceeded rest days
 * - Mark expired trials
 */
export async function processDailyGauntletUpdates(): Promise<{
  processed: number;
  failed: number;
}> {
  const db = getDb();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Get all active gauntlets
    const activeGauntlets = await db
      .select()
      .from(gauntlet)
      .where(eq(gauntlet.status, "active"));

    let processed = 0;
    let failed = 0;

    for (const g of activeGauntlets) {
      // Check if user was active yesterday
      const wasActiveYesterday =
        g.lastActivityAt && g.lastActivityAt >= yesterday;

      if (!wasActiveYesterday) {
        // Increment rest days
        const newRestDays = g.restDaysUsed + 1;

        if (newRestDays > g.maxRestDays) {
          // Too many rest days - fail the gauntlet
          await db
            .update(gauntlet)
            .set({
              status: "failed",
              failedAt: now,
              restDaysUsed: newRestDays,
              currentStreak: 0,
              updatedAt: now,
            })
            .where(eq(gauntlet.userId, g.userId));
          failed++;
        } else {
          // Still within rest day allowance - reset streak
          await db
            .update(gauntlet)
            .set({
              restDaysUsed: newRestDays,
              currentStreak: 0,
              updatedAt: now,
            })
            .where(eq(gauntlet.userId, g.userId));
        }
      }

      processed++;
    }

    return { processed, failed };
  } catch (error) {
    console.error("[Gauntlet] Daily update failed:", error);
    return { processed: 0, failed: 0 };
  }
}
