/**
 * Access Control Utilities
 *
 * Determines what features a user can access based on their plan and gauntlet status.
 * Works with both paid subscriptions and gauntlet trial extensions.
 */

import { getDb } from "@/lib/db";
import { users, gauntlet } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isPaidPlan, getPlanLimits, GAUNTLET } from "./constants";

// =============================================================================
// Types
// =============================================================================

export type AccessLevel = "none" | "trial" | "paid";

export interface AccessState {
  /** Current access level */
  level: AccessLevel;

  /** Whether user has active access (trial or paid) */
  hasAccess: boolean;

  /** Whether user is in gauntlet trial */
  isInTrial: boolean;

  /** Whether user has paid subscription */
  isPaid: boolean;

  /** Whether trial has expired */
  isTrialExpired: boolean;

  /** Days remaining in trial (0 if not in trial or expired) */
  trialDaysRemaining: number;

  /** Plan limits for the user */
  limits: ReturnType<typeof getPlanLimits>;

  /** User's plan ID */
  planId: string | null;

  /** Gauntlet status if applicable */
  gauntletStatus: "active" | "completed" | "failed" | "converted" | null;

  /** Whether user has completed the gauntlet and can claim rewards */
  canClaimGauntletRewards: boolean;
}

export interface UserWithGauntlet {
  id: string;
  planId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionPeriodEnd: Date | null;
  gauntlet: {
    status: "active" | "completed" | "failed" | "converted";
    baseDays: number;
    earnedDays: number;
    trialExpiresAt: Date;
    rewardsClaimed: boolean;
  } | null;
}

// =============================================================================
// Core Access Functions
// =============================================================================

/**
 * Get user access state from database
 */
export async function getUserAccessState(userId: string): Promise<AccessState | null> {
  const db = getDb();

  const result = await db
    .select({
      id: users.id,
      planId: users.planId,
      stripeSubscriptionId: users.stripeSubscriptionId,
      subscriptionPeriodEnd: users.subscriptionPeriodEnd,
      gauntletStatus: gauntlet.status,
      baseDays: gauntlet.baseDays,
      earnedDays: gauntlet.earnedDays,
      trialExpiresAt: gauntlet.trialExpiresAt,
      rewardsClaimed: gauntlet.rewardsClaimed,
    })
    .from(users)
    .leftJoin(gauntlet, eq(users.id, gauntlet.userId))
    .where(eq(users.id, userId))
    .limit(1);

  const row = result[0];
  if (!row) return null;

  const userWithGauntlet: UserWithGauntlet = {
    id: row.id,
    planId: row.planId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    subscriptionPeriodEnd: row.subscriptionPeriodEnd,
    gauntlet: row.gauntletStatus
      ? {
          status: row.gauntletStatus,
          baseDays: row.baseDays ?? GAUNTLET.baseDays,
          earnedDays: row.earnedDays ?? 0,
          trialExpiresAt: row.trialExpiresAt!,
          rewardsClaimed: row.rewardsClaimed ?? false,
        }
      : null,
  };

  return computeAccessState(userWithGauntlet);
}

/**
 * Compute access state from user data (no database call)
 */
export function computeAccessState(user: UserWithGauntlet): AccessState {
  const now = new Date();
  const isPaid = isPaidPlan(user.planId);
  const limits = getPlanLimits(user.planId);

  // Check if user has active subscription with valid period
  const hasActiveSubscription =
    isPaid && user.subscriptionPeriodEnd && user.subscriptionPeriodEnd > now;

  // Check gauntlet trial status
  const gauntletData = user.gauntlet;
  const isInGauntlet = gauntletData?.status === "active" || gauntletData?.status === "converted";
  const trialExpiresAt = gauntletData?.trialExpiresAt;
  const isTrialActive = isInGauntlet && trialExpiresAt && trialExpiresAt > now;
  const isTrialExpired = isInGauntlet && trialExpiresAt && trialExpiresAt <= now;

  // Calculate days remaining
  let trialDaysRemaining = 0;
  if (isTrialActive && trialExpiresAt) {
    const msRemaining = trialExpiresAt.getTime() - now.getTime();
    trialDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  }

  // Determine access level
  let level: AccessLevel = "none";
  if (hasActiveSubscription) {
    level = "paid";
  } else if (isTrialActive) {
    level = "trial";
  }

  // Can claim gauntlet rewards if completed and not yet claimed
  const canClaimGauntletRewards =
    gauntletData?.status === "completed" && !gauntletData.rewardsClaimed;

  return {
    level,
    hasAccess: level !== "none",
    isInTrial: level === "trial",
    isPaid: level === "paid",
    isTrialExpired: isTrialExpired ?? false,
    trialDaysRemaining,
    limits: isPaid ? getPlanLimits(user.planId) : limits,
    planId: user.planId,
    gauntletStatus: gauntletData?.status ?? null,
    canClaimGauntletRewards,
  };
}

// =============================================================================
// Feature Access Checks
// =============================================================================

/**
 * Check if user can access AI features
 */
export function canAccessAI(state: AccessState): boolean {
  // Both trial and paid users can use AI (limited by mana)
  return state.hasAccess && state.limits.canUseAi;
}

/**
 * Check if user can access DevMode
 */
export function canAccessDevMode(state: AccessState): boolean {
  // Only paid users can use DevMode
  return state.isPaid && state.limits.canUseDevMode;
}

/**
 * Check if user can create more ideas
 * @param currentIdeaCount - Number of ideas user currently has
 */
export function canCreateIdea(state: AccessState, currentIdeaCount: number): boolean {
  if (!state.hasAccess) return false;
  return currentIdeaCount < state.limits.maxIdeas;
}

/**
 * Check if user can add more features to an idea
 * @param currentFeatureCount - Number of features the idea currently has
 */
export function canAddFeature(state: AccessState, currentFeatureCount: number): boolean {
  if (!state.hasAccess) return false;
  return currentFeatureCount < state.limits.maxFeaturesPerIdea;
}

/**
 * Get remaining quota for ideas
 * @param currentIdeaCount - Number of ideas user currently has
 */
export function getRemainingIdeaQuota(state: AccessState, currentIdeaCount: number): number {
  if (!state.hasAccess) return 0;
  if (state.limits.maxIdeas === Infinity) return Infinity;
  return Math.max(0, state.limits.maxIdeas - currentIdeaCount);
}

/**
 * Get remaining quota for features
 * @param currentFeatureCount - Number of features the idea currently has
 */
export function getRemainingFeatureQuota(state: AccessState, currentFeatureCount: number): number {
  if (!state.hasAccess) return 0;
  if (state.limits.maxFeaturesPerIdea === Infinity) return Infinity;
  return Math.max(0, state.limits.maxFeaturesPerIdea - currentFeatureCount);
}

// =============================================================================
// Trial Status Helpers
// =============================================================================

/**
 * Get display-friendly trial status message
 */
export function getTrialStatusMessage(state: AccessState): string | null {
  if (state.isPaid) {
    return state.gauntletStatus === "active" || state.gauntletStatus === "converted"
      ? "Gauntlet continues for bonus rewards"
      : null;
  }

  if (state.isInTrial) {
    if (state.trialDaysRemaining <= 1) {
      return "Trial expires soon - complete quests to extend!";
    }
    if (state.trialDaysRemaining <= 3) {
      return `${state.trialDaysRemaining} days remaining - keep the streak going!`;
    }
    return `${state.trialDaysRemaining} days remaining in trial`;
  }

  if (state.isTrialExpired) {
    return "Trial has expired - subscribe to continue";
  }

  return null;
}

/**
 * Get upgrade prompt based on user state
 */
export function getUpgradePrompt(state: AccessState): {
  title: string;
  description: string;
  urgency: "low" | "medium" | "high";
} | null {
  if (state.isPaid) return null;

  if (state.isTrialExpired) {
    return {
      title: "Your trial has ended",
      description: "Subscribe now to continue building your ideas",
      urgency: "high",
    };
  }

  if (state.isInTrial && state.trialDaysRemaining <= 3) {
    return {
      title: `${state.trialDaysRemaining} day${state.trialDaysRemaining === 1 ? "" : "s"} left`,
      description: "Complete gauntlet quests to extend, or subscribe anytime",
      urgency: "medium",
    };
  }

  if (state.isInTrial) {
    return {
      title: "Enjoying Coda?",
      description: "Claim your hat to unlock unlimited ideas and DevMode",
      urgency: "low",
    };
  }

  return null;
}

// =============================================================================
// Quick Access Checks (Server Action helpers)
// =============================================================================

/**
 * Quick check if user has any access (trial or paid)
 * Use this for simple authorization in server actions
 */
export async function requireAccess(userId: string): Promise<AccessState> {
  const state = await getUserAccessState(userId);
  if (!state) {
    throw new Error("User not found");
  }
  if (!state.hasAccess) {
    throw new Error(state.isTrialExpired ? "Trial expired" : "Subscription required");
  }
  return state;
}

/**
 * Quick check if user has paid access
 * Use this for premium features like DevMode
 */
export async function requirePaidAccess(userId: string): Promise<AccessState> {
  const state = await requireAccess(userId);
  if (!state.isPaid) {
    throw new Error("This feature requires a paid subscription");
  }
  return state;
}
