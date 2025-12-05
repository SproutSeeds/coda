/**
 * Plan and Gauntlet Constants
 *
 * The Sorcerer's Path:
 * - Wanderer (Free): 7-day base trial, can extend to 30 days via gauntlet quests
 * - Sorcerer (Paid): Full access immediately, can still complete gauntlet for rewards
 *
 * The Gauntlet:
 * - 30-day quest chain with daily challenges
 * - Complete quests to earn extra trial days (free users) or bonus rewards (paid users)
 * - Survive all 30 days = exclusive drops and rewards
 */

// =============================================================================
// PLAN IDENTIFIERS
// =============================================================================

export const PLAN_IDS = {
  /** Free tier - limited access, gauntlet required to extend */
  WANDERER: "wanderer",
  /** Paid monthly subscription */
  SORCERER_MONTHLY: "sorcerer_monthly",
  /** Paid annual subscription */
  SORCERER_ANNUAL: "sorcerer_annual",
  /** Legacy: old "sorcerer" without variant */
  SORCERER: "sorcerer",
  /** Trial period (deprecated - use wanderer + gauntlet) */
  TRIAL: "trial",
  /** Legacy alias for Wanderer */
  BASIC: "wanderer",
} as const;

export type PlanId = (typeof PLAN_IDS)[keyof typeof PLAN_IDS];

/** Check if a plan ID represents a paid subscription */
export function isPaidPlan(planId: string | null | undefined): boolean {
  if (!planId) return false;
  return (
    planId === PLAN_IDS.SORCERER ||
    planId === PLAN_IDS.SORCERER_MONTHLY ||
    planId === PLAN_IDS.SORCERER_ANNUAL ||
    planId.startsWith("sorcerer")
  );
}

/** Check if a plan ID represents the free tier */
export function isFreePlan(planId: string | null | undefined): boolean {
  return !planId || planId === PLAN_IDS.WANDERER || planId === PLAN_IDS.TRIAL || planId === PLAN_IDS.BASIC;
}

// =============================================================================
// CREDIT PRICING (Mana Costs)
// =============================================================================

export const CREDIT_PRICING = {
  CHAT_MESSAGE: 10,
  CODE_GENERATION: 50,
  IMAGE_GENERATION: 100,
  AUDIO_TRANSCRIBE_PER_MIN: 50,
  VIDEO_TRANSCRIBE_PER_MIN: 100,
} as const;

// =============================================================================
// PLAN LIMITS
// =============================================================================

export const PLAN_LIMITS = {
  [PLAN_IDS.WANDERER]: {
    maxIdeas: 3,
    maxFeaturesPerIdea: 5,
    storageGb: 0.5,
    canUseAi: true, // Limited by mana
    canUseDevMode: false,
    monthlyMana: 0, // No monthly grant, only gauntlet rewards
  },
  [PLAN_IDS.SORCERER_MONTHLY]: {
    maxIdeas: Infinity,
    maxFeaturesPerIdea: Infinity,
    storageGb: 10,
    canUseAi: true,
    canUseDevMode: true,
    monthlyMana: 200_000,
  },
  [PLAN_IDS.SORCERER_ANNUAL]: {
    maxIdeas: Infinity,
    maxFeaturesPerIdea: Infinity,
    storageGb: 10,
    canUseAi: true,
    canUseDevMode: true,
    monthlyMana: 200_000,
  },
  [PLAN_IDS.SORCERER]: { // Legacy mapping
    maxIdeas: Infinity,
    maxFeaturesPerIdea: Infinity,
    storageGb: 10,
    canUseAi: true,
    canUseDevMode: true,
    monthlyMana: 200_000,
  },
  [PLAN_IDS.TRIAL]: { // Legacy mapping
    maxIdeas: 3,
    maxFeaturesPerIdea: 5,
    storageGb: 0.5,
    canUseAi: true,
    canUseDevMode: false,
    monthlyMana: 0,
  },
} as const;

/** Get limits for a plan, defaulting to wanderer for unknown plans */
export function getPlanLimits(planId: string | null | undefined) {
  if (!planId) return PLAN_LIMITS[PLAN_IDS.WANDERER];
  if (planId in PLAN_LIMITS) return PLAN_LIMITS[planId as keyof typeof PLAN_LIMITS];
  if (isPaidPlan(planId)) return PLAN_LIMITS[PLAN_IDS.SORCERER_MONTHLY];
  return PLAN_LIMITS[PLAN_IDS.WANDERER];
}

// =============================================================================
// PRICING
// =============================================================================

export const PRICING = {
  monthly: {
    usd: 25,
    stripePriceId: process.env.STRIPE_PRICE_SORCERER_MONTHLY || "",
  },
  annual: {
    usd: 240,
    monthlyEquivalent: 20, // $240/12 = $20/mo
    savings: 60, // $25*12 - $240 = $60
    stripePriceId: process.env.STRIPE_PRICE_SORCERER_ANNUAL || "",
  },
} as const;

// =============================================================================
// THE GAUNTLET - 30 Day Challenge
// =============================================================================

export const GAUNTLET = {
  /** Base trial days for free users (before any quests) */
  baseDays: 7,

  /** Maximum total days (base + earned) */
  maxDays: 30,

  /** Number of "rest days" allowed (missed days before gauntlet fails) */
  maxRestDays: 3,

  /** Days required to complete the gauntlet and earn final rewards */
  completionDays: 30,
} as const;

// =============================================================================
// GAUNTLET QUESTS
// =============================================================================

export const QUEST_IDS = {
  // Daily quests (can complete once per day)
  DAILY_LOGIN: "daily_login",
  CREATE_IDEA: "create_idea",
  ADD_FEATURE: "add_feature",
  USE_AI: "use_ai",
  STAR_IDEA: "star_idea",
  EXPORT_IDEA: "export_idea",

  // Milestone quests (one-time achievements)
  FIRST_IDEA: "first_idea",
  COMPLETE_IDEA: "complete_idea", // Mark all features as done
  FIVE_IDEAS: "five_ideas",
  INVITE_FRIEND: "invite_friend",
} as const;

export type QuestId = (typeof QUEST_IDS)[keyof typeof QUEST_IDS];

export type QuestDefinition = {
  id: QuestId;
  name: string;
  description: string;
  /** Days added to trial (for free users) */
  trialDaysReward: number;
  /** Mana reward (for all users) */
  manaReward: number;
  /** XP reward */
  xpReward: number;
  /** Can be completed multiple times? */
  repeatable: boolean;
  /** If repeatable, how often? */
  cooldownHours?: number;
  /** Is this a milestone (one-time) quest? */
  isMilestone: boolean;
};

export const QUESTS: Record<QuestId, QuestDefinition> = {
  // Daily quests
  [QUEST_IDS.DAILY_LOGIN]: {
    id: QUEST_IDS.DAILY_LOGIN,
    name: "Return to the Tower",
    description: "Log in to Coda today",
    trialDaysReward: 0.5,
    manaReward: 500,
    xpReward: 10,
    repeatable: true,
    cooldownHours: 24,
    isMilestone: false,
  },
  [QUEST_IDS.CREATE_IDEA]: {
    id: QUEST_IDS.CREATE_IDEA,
    name: "Spark of Inspiration",
    description: "Create a new idea",
    trialDaysReward: 1,
    manaReward: 1000,
    xpReward: 25,
    repeatable: true,
    cooldownHours: 24,
    isMilestone: false,
  },
  [QUEST_IDS.ADD_FEATURE]: {
    id: QUEST_IDS.ADD_FEATURE,
    name: "Refine the Vision",
    description: "Add a feature to an idea",
    trialDaysReward: 0.5,
    manaReward: 500,
    xpReward: 15,
    repeatable: true,
    cooldownHours: 24,
    isMilestone: false,
  },
  [QUEST_IDS.USE_AI]: {
    id: QUEST_IDS.USE_AI,
    name: "Consult the Oracle",
    description: "Use AI assistance once",
    trialDaysReward: 1,
    manaReward: 0, // Already costs mana
    xpReward: 20,
    repeatable: true,
    cooldownHours: 24,
    isMilestone: false,
  },
  [QUEST_IDS.STAR_IDEA]: {
    id: QUEST_IDS.STAR_IDEA,
    name: "Mark of Priority",
    description: "Star an idea",
    trialDaysReward: 0.5,
    manaReward: 250,
    xpReward: 5,
    repeatable: true,
    cooldownHours: 24,
    isMilestone: false,
  },
  [QUEST_IDS.EXPORT_IDEA]: {
    id: QUEST_IDS.EXPORT_IDEA,
    name: "Share Your Knowledge",
    description: "Export an idea",
    trialDaysReward: 1,
    manaReward: 1000,
    xpReward: 30,
    repeatable: true,
    cooldownHours: 24,
    isMilestone: false,
  },

  // Milestone quests (one-time)
  [QUEST_IDS.FIRST_IDEA]: {
    id: QUEST_IDS.FIRST_IDEA,
    name: "The First Incantation",
    description: "Create your very first idea",
    trialDaysReward: 2,
    manaReward: 5000,
    xpReward: 100,
    repeatable: false,
    isMilestone: true,
  },
  [QUEST_IDS.COMPLETE_IDEA]: {
    id: QUEST_IDS.COMPLETE_IDEA,
    name: "Spell Complete",
    description: "Mark all features of an idea as complete",
    trialDaysReward: 2,
    manaReward: 5000,
    xpReward: 150,
    repeatable: false,
    isMilestone: true,
  },
  [QUEST_IDS.FIVE_IDEAS]: {
    id: QUEST_IDS.FIVE_IDEAS,
    name: "Grimoire Growing",
    description: "Create 5 ideas total",
    trialDaysReward: 3,
    manaReward: 10000,
    xpReward: 250,
    repeatable: false,
    isMilestone: true,
  },
  [QUEST_IDS.INVITE_FRIEND]: {
    id: QUEST_IDS.INVITE_FRIEND,
    name: "Summon an Ally",
    description: "Invite a friend who joins",
    trialDaysReward: 3,
    manaReward: 10000,
    xpReward: 300,
    repeatable: false,
    isMilestone: true,
  },
} as const;

// =============================================================================
// GAUNTLET COMPLETION REWARDS (The Drops!)
// =============================================================================

export const GAUNTLET_REWARDS = {
  /** Exclusive title for profile */
  title: "Gauntlet Survivor",

  /** One-time mana bonus on first subscription */
  bonusMana: 50_000,

  /** Discount on first month (percentage) */
  firstMonthDiscountPercent: 50,

  /** Cosmetic rewards */
  cosmetics: [
    {
      id: "founders_cloak",
      name: "Founder's Cloak",
      description: "A shimmering cloak that marks you as one who survived the gauntlet",
      type: "badge" as const,
    },
    {
      id: "rare_familiar",
      name: "Rare Familiar",
      description: "A mystical companion earned through dedication",
      type: "companion" as const,
    },
  ],
} as const;

// =============================================================================
// SUBSCRIPTION CARD THEMES (for choose-path UI)
// =============================================================================

export const SUBSCRIPTION_THEMES = {
  monthly: {
    title: "Claim Your Hat",
    subtitle: "Begin your practice",
    description: "Join the Sorcerer's Guild and gain full access to the Grimoire.",
    iconEmoji: "🎩",
    accentColor: "primary",
  },
  annual: {
    title: "Find Your Wand",
    subtitle: "Your destiny awaits",
    description: "Commit to your path and save $60 over the year.",
    iconEmoji: "🪄",
    accentColor: "amber",
    badge: "Best Value",
  },
} as const;
