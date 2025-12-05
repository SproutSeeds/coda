import { integer, pgTable, text, timestamp, uuid, index, uniqueIndex, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";
import { users } from "../schema";

// --- ENUMS ---
export const questStatusEnum = pgEnum("quest_status", ["assigned", "completed", "claimed"]);
export const questFrequencyEnum = pgEnum("quest_frequency", ["daily", "weekly", "story"]);
export const referralStatusEnum = pgEnum("referral_status", ["pending", "completed"]);
export const giftStatusEnum = pgEnum("gift_status", ["pending", "accepted", "expired"]);
export const refundRequestStatusEnum = pgEnum("refund_request_status", ["pending", "approved", "denied"]);

// --- WALLETS (Mana) ---
export const wallets = pgTable("wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  // The Core Resource (Included Monthly Budget)
  manaBalance: integer("mana_balance").notNull().default(0), // "Core Mana"

  // Booster Resource (Paid/Extra)
  boosterBalance: integer("booster_balance").notNull().default(0), // "Booster Mana" - Pure fuel, no prestige

  // Caps & Regen (Determined by Level + Subscription)
  maxMana: integer("max_mana").notNull().default(100),
  manaRegenRate: integer("mana_regen_rate").notNull().default(1), // Mana per minute (Meditation)

  // Tracking
  lastMeditationAt: timestamp("last_meditation_at", { withTimezone: true }).defaultNow().notNull(),
  lastCoreGrantAt: timestamp("last_core_grant_at", { withTimezone: true }), // When monthly Core Mana was last granted

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- MANA POTIONS (Consumable Inventory) ---
export const manaPotions = pgTable("mana_potions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  // Potion Counts by Size
  smallPotions: integer("small_potions").notNull().default(0), // Restores 25 Mana
  mediumPotions: integer("medium_potions").notNull().default(0), // Restores 50 Mana
  largePotions: integer("large_potions").notNull().default(0), // Restores 100 Mana

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- PROGRESSION (Solo Leveling) ---
export const progression = pgTable("progression", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  // Leveling
  level: integer("level").notNull().default(1),
  currentXp: integer("current_xp").notNull().default(0),

  // The Awakening ($100 Expansion)
  isAwakened: boolean("is_awakened").notNull().default(false),
  awakenedAt: timestamp("awakened_at", { withTimezone: true }),

  // Channeling ($20/mo Subscription)
  isChanneling: boolean("is_channeling").notNull().default(false),
  channelingExpiresAt: timestamp("channeling_expires_at", { withTimezone: true }),

  // Quest Hub daily visit tracking (for BubbleTitle greeting)
  questHubLastVisit: timestamp("quest_hub_last_visit", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- REFERRALS (Summon a Friend) ---
export const referrals = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  inviteeId: text("invitee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  status: referralStatusEnum("status").notNull().default("pending"),
  rewardsClaimed: jsonb("rewards_claimed").default([]).notNull(), // Array of claimed milestone keys

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  inviterIdx: index("idx_referrals_inviter").on(table.inviterId),
  inviteeIdx: uniqueIndex("idx_referrals_invitee").on(table.inviteeId), // One inviter per user
}));

// --- GIFTS (Gift-a-Month) ---
export const gifts = pgTable("gifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  senderId: text("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  status: giftStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // 7 days to accept

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  senderIdx: index("idx_gifts_sender").on(table.senderId),
  recipientIdx: index("idx_gifts_recipient").on(table.recipientId),
}));

// --- REFUND REQUESTS ---
export const refundRequests = pgTable("refund_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // What's being refunded
  stripePaymentIntentId: text("stripe_payment_intent_id"), // For one-time payments
  stripeInvoiceId: text("stripe_invoice_id"), // For subscription invoices
  stripeChargeId: text("stripe_charge_id"), // The actual charge to refund
  amountCents: integer("amount_cents").notNull(), // Amount in cents

  // Request details
  reason: text("reason").notNull(), // User's reason for requesting refund
  status: refundRequestStatusEnum("status").notNull().default("pending"),

  // Admin response
  adminUserId: text("admin_user_id").references(() => users.id, { onDelete: "set null" }),
  adminNotes: text("admin_notes"),
  stripeRefundId: text("stripe_refund_id"), // Set after successful refund

  // Timestamps
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull(), // When the original charge was made
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }), // When admin processed the request
}, (table) => ({
  userIdx: index("idx_refund_requests_user").on(table.userId),
  statusIdx: index("idx_refund_requests_status").on(table.status),
}));

// --- CREDIT LEDGER (Transaction History) ---
export const creditLedgerTypeEnum = pgEnum("credit_ledger_type", ["credit", "debit"]);

export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Transaction details
  amount: integer("amount").notNull(), // Mana amount (positive for both credit and debit)
  type: creditLedgerTypeEnum("type").notNull(), // credit = added, debit = removed
  bucket: text("bucket").notNull().default("mana"), // 'mana' (subscription) or 'booster' (purchased)

  // What caused this transaction
  reason: text("reason").notNull(), // e.g., 'subscription_grant', 'booster_purchase', 'usage', 'refund'
  referenceType: text("reference_type"), // 'subscription', 'booster', 'gift', 'refund', 'usage'
  referenceId: text("reference_id"), // Stripe charge ID, subscription ID, etc.

  // Balance after this transaction (for auditing)
  balanceAfter: integer("balance_after"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_credit_ledger_user").on(table.userId),
  userCreatedIdx: index("idx_credit_ledger_user_created").on(table.userId, table.createdAt),
}));

// --- QUESTS (Daily Rituals) ---
export const quests = pgTable("quests", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(), // e.g., 'daily-scribe-spell'
  title: text("title").notNull(),
  description: text("description").notNull(),

  frequency: questFrequencyEnum("frequency").notNull().default("daily"),

  // Rewards
  xpReward: integer("xp_reward").notNull().default(0),
  potionReward: text("potion_reward"), // 'small', 'medium', 'large', or null
  potionCount: integer("potion_count").notNull().default(1), // How many potions to grant

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex("idx_quests_slug").on(table.slug),
}));

export const userQuests = pgTable("user_quests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  questId: uuid("quest_id")
    .notNull()
    .references(() => quests.id, { onDelete: "cascade" }),

  status: questStatusEnum("status").notNull().default("assigned"),
  progress: integer("progress").notNull().default(0), // For multi-step quests
  target: integer("target").notNull().default(1),

  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }), // When rewards were collected
}, (table) => ({
  userStatusIdx: index("idx_user_quests_user_status").on(table.userId, table.status),
  uniqueActive: uniqueIndex("uniq_user_quest_active")
    .on(table.userId, table.questId)
    .where(inArray(table.status, ["assigned", "completed"])), // Only one active instance per quest
}));

// --- RELATIONS ---
import { relations } from "drizzle-orm";

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  inviter: one(users, {
    fields: [referrals.inviterId],
    references: [users.id],
    relationName: "referral_inviter",
  }),
  invitee: one(users, {
    fields: [referrals.inviteeId],
    references: [users.id],
    relationName: "referral_invitee",
  }),
}));

export const giftsRelations = relations(gifts, ({ one }) => ({
  sender: one(users, {
    fields: [gifts.senderId],
    references: [users.id],
    relationName: "gift_sender",
  }),
  recipient: one(users, {
    fields: [gifts.recipientId],
    references: [users.id],
    relationName: "gift_recipient",
  }),
}));

// =============================================================================
// THE GAUNTLET - 30-Day Trial Challenge
// =============================================================================

export const gauntletStatusEnum = pgEnum("gauntlet_status", ["active", "completed", "failed", "converted"]);

/**
 * Tracks a user's progress through the Gauntlet challenge.
 * - Active: Currently running the gauntlet
 * - Completed: Survived all 30 days
 * - Failed: Ran out of rest days
 * - Converted: Subscribed mid-gauntlet (gauntlet continues for rewards)
 */
export const gauntlet = pgTable("gauntlet", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  // Status
  status: gauntletStatusEnum("status").notNull().default("active"),

  // Trial days tracking
  baseDays: integer("base_days").notNull().default(7), // Starting trial days
  earnedDays: integer("earned_days").notNull().default(0), // Days earned through quests

  // Rest days (allowed missed days before gauntlet fails)
  restDaysUsed: integer("rest_days_used").notNull().default(0),
  maxRestDays: integer("max_rest_days").notNull().default(3),

  // Streak tracking
  currentStreak: integer("current_streak").notNull().default(0), // Consecutive days active
  longestStreak: integer("longest_streak").notNull().default(0),
  totalActiveDays: integer("total_active_days").notNull().default(0),

  // Key dates
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }).notNull(), // Base + earned days
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }), // Last quest completion
  completedAt: timestamp("completed_at", { withTimezone: true }), // When gauntlet was completed
  failedAt: timestamp("failed_at", { withTimezone: true }), // When gauntlet failed
  convertedAt: timestamp("converted_at", { withTimezone: true }), // When user subscribed

  // Rewards
  rewardsClaimed: boolean("rewards_claimed").notNull().default(false),
  rewardsClaimedAt: timestamp("rewards_claimed_at", { withTimezone: true }),

  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tracks individual quest completions within the gauntlet.
 * Daily quests can be completed once per day (cooldown-based).
 * Milestone quests are one-time achievements.
 */
export const gauntletQuestCompletions = pgTable("gauntlet_quest_completions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Quest identification (matches QuestId from constants.ts)
  questId: text("quest_id").notNull(), // e.g., "daily_login", "first_idea"

  // Rewards granted
  trialDaysGranted: integer("trial_days_granted").notNull().default(0), // Fractional days stored as 10ths
  manaGranted: integer("mana_granted").notNull().default(0),
  xpGranted: integer("xp_granted").notNull().default(0),

  // Timestamps
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  cooldownEndsAt: timestamp("cooldown_ends_at", { withTimezone: true }), // When repeatable quest can be done again
}, (table) => ({
  userQuestIdx: index("idx_gauntlet_quest_completions_user").on(table.userId, table.questId),
  userCooldownIdx: index("idx_gauntlet_quest_completions_cooldown").on(table.userId, table.cooldownEndsAt),
}));

/**
 * Tracks earned cosmetic rewards from gauntlet completion.
 */
export const gauntletRewards = pgTable("gauntlet_rewards", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Reward identification
  rewardId: text("reward_id").notNull(), // e.g., "founders_cloak", "rare_familiar"
  rewardType: text("reward_type").notNull(), // "badge", "title", "companion", "discount"

  // For discount rewards
  discountPercent: integer("discount_percent"), // e.g., 50 for 50% off
  discountUsed: boolean("discount_used").notNull().default(false),
  discountUsedAt: timestamp("discount_used_at", { withTimezone: true }),

  // Timestamps
  earnedAt: timestamp("earned_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userRewardUnique: uniqueIndex("uniq_gauntlet_rewards_user_reward").on(table.userId, table.rewardId),
}));

// --- GAUNTLET RELATIONS ---
export const gauntletRelations = relations(gauntlet, ({ one, many }) => ({
  user: one(users, {
    fields: [gauntlet.userId],
    references: [users.id],
  }),
  questCompletions: many(gauntletQuestCompletions),
  rewards: many(gauntletRewards),
}));

export const gauntletQuestCompletionsRelations = relations(gauntletQuestCompletions, ({ one }) => ({
  user: one(users, {
    fields: [gauntletQuestCompletions.userId],
    references: [users.id],
  }),
  gauntlet: one(gauntlet, {
    fields: [gauntletQuestCompletions.userId],
    references: [gauntlet.userId],
  }),
}));

export const gauntletRewardsRelations = relations(gauntletRewards, ({ one }) => ({
  user: one(users, {
    fields: [gauntletRewards.userId],
    references: [users.id],
  }),
}));

// =============================================================================
// WEBHOOK EVENTS - Audit trail for Stripe webhooks
// =============================================================================

export const webhookEventStatusEnum = pgEnum("webhook_event_status", ["received", "processing", "completed", "failed"]);

/**
 * Tracks all incoming Stripe webhook events for debugging and audit purposes.
 * Every webhook event is logged with its processing status and any errors.
 */
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(), // Stripe's event ID for deduplication
  eventType: text("event_type").notNull(), // e.g., "checkout.session.completed"
  userId: text("user_id"), // Associated user (if extractable from event)
  status: webhookEventStatusEnum("status").notNull().default("received"),

  // Event data (only relevant fields, not full payload)
  payload: jsonb("payload"), // Sanitized data for debugging

  // Error tracking
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),

  // Timestamps
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  stripeEventIdx: uniqueIndex("idx_webhook_events_stripe_event").on(table.stripeEventId),
  statusIdx: index("idx_webhook_events_status").on(table.status),
  userIdx: index("idx_webhook_events_user").on(table.userId),
  createdIdx: index("idx_webhook_events_created").on(table.createdAt),
}));
