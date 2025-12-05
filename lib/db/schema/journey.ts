import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users, ideas } from "../schema";

// =============================================================================
// JOURNEY PROGRESS - Main tracking table
// =============================================================================

/**
 * Tracks a user's progress through The Path (Stages 1-10)
 * - Stages 1-5: The Wanderer's Path (available to all)
 * - Stages 6-10: The Sorcerer's Ascension (requires subscription)
 */
export const journeyProgress = pgTable("journey_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Current position
  currentStage: integer("current_stage").notNull().default(1), // 1-10

  // Resources earned
  totalMana: integer("total_mana").notNull().default(0), // Mana generated through creation
  manaPoolUnlocked: integer("mana_pool_unlocked").notNull().default(0), // Sorcerer: unlocked from 200k pool
  bonusManaEarned: integer("bonus_mana_earned").notNull().default(0), // Sorcerer: bonus from stages 6-10
  crystallizedSand: integer("crystallized_sand").notNull().default(0), // Wanderer: scoops earned

  // Task completion tracking
  tasksCompleted: jsonb("tasks_completed")
    .$type<TasksCompletedState>()
    .notNull()
    .default(sql`'${JSON.stringify(getDefaultTasksState())}'::jsonb`),

  // Stage completion timestamps
  stagesCompleted: jsonb("stages_completed")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),

  // Feature unlocks (Sorcerer only)
  featuresUnlocked: jsonb("features_unlocked")
    .$type<FeatureKey[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),

  // Meditation (unlocked at stage 10)
  meditationUnlocked: boolean("meditation_unlocked").notNull().default(false),
  meditationLevel: integer("meditation_level").notNull().default(0),

  // Journey milestones
  wandererPathCompletedAt: timestamp("wanderer_path_completed_at", { withTimezone: true }),
  sorcererAscensionCompletedAt: timestamp("sorcerer_ascension_completed_at", { withTimezone: true }),

  // Tutorial tracking
  tutorialStep: integer("tutorial_step").notNull().default(0),
  tutorialSkipped: boolean("tutorial_skipped").notNull().default(false),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userUnique: uniqueIndex("journey_progress_user_unique").on(table.userId),
  stageIdx: index("idx_journey_progress_stage").on(table.currentStage),
}));

// =============================================================================
// TASK COMPLETIONS - Individual task completion history
// =============================================================================

export const journeyTaskCompletions = pgTable("journey_task_completions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  stage: integer("stage").notNull(), // 1-10
  task: integer("task").notNull(), // 1-5

  // What was earned
  manaEarned: integer("mana_earned").notNull().default(0),
  sandEarned: integer("sand_earned").notNull().default(0), // In tenths for precision

  // Context
  actionType: text("action_type").notNull(), // e.g., 'create_idea', 'add_feature'
  actionReferenceId: text("action_reference_id"), // ID of triggering entity

  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStageTaskUnique: uniqueIndex("journey_task_unique").on(table.userId, table.stage, table.task),
  userIdx: index("idx_journey_task_completions_user").on(table.userId),
  userStageIdx: index("idx_journey_task_completions_stage").on(table.userId, table.stage),
}));

// =============================================================================
// STAGE COMPLETIONS - Stage completion history
// =============================================================================

export const journeyStageCompletions = pgTable("journey_stage_completions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  stage: integer("stage").notNull(), // 1-10

  // Rewards granted
  sandGranted: integer("sand_granted").notNull().default(0), // Scoops (Wanderer)
  manaPoolGranted: integer("mana_pool_granted").notNull().default(0), // Unlocked mana (Sorcerer 1-5)
  bonusManaGranted: integer("bonus_mana_granted").notNull().default(0), // Bonus mana (Sorcerer 6-10)
  featureUnlocked: text("feature_unlocked"), // Feature key (stages 6-10)

  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStageUnique: uniqueIndex("journey_stage_unique").on(table.userId, table.stage),
  userIdx: index("idx_journey_stage_completions_user").on(table.userId),
}));

// =============================================================================
// IDEA JOURNEY PROGRESS - Per-idea quest tracking
// =============================================================================

/**
 * Tracks quest progress for each individual idea.
 * - Global journey_progress tracks "how to use Coda" (one-time onboarding)
 * - This table tracks "building out this specific idea" (repeatable per idea)
 * - Rewards are shared/global (earn once per stage across all ideas)
 * - Progress is per-idea (each idea tracks independently)
 */
export const ideaJourneyProgress = pgTable("idea_journey_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Current position (per-idea starts at stage 2)
  currentStage: integer("current_stage").notNull().default(2),

  // Task completion tracking (stages 2-10, since stage 1 is global)
  tasksCompleted: jsonb("tasks_completed")
    .$type<IdeaTasksCompletedState>()
    .notNull()
    .default(sql`'${JSON.stringify(getDefaultIdeaTasksState())}'::jsonb`),

  // Stage completion timestamps
  stagesCompleted: jsonb("stages_completed")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),

  // AI evaluation checkpoints (for Sorcerer path)
  lastEvaluationAt: timestamp("last_evaluation_at", { withTimezone: true }),
  lastEvaluationResult: jsonb("last_evaluation_result").$type<EvaluationResult>(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ideaUnique: uniqueIndex("idea_journey_progress_idea_unique").on(table.ideaId),
  userIdx: index("idx_idea_journey_progress_user_id").on(table.userId),
}));

// =============================================================================
// RELATIONS
// =============================================================================

export const journeyProgressRelations = relations(journeyProgress, ({ one }) => ({
  user: one(users, {
    fields: [journeyProgress.userId],
    references: [users.id],
  }),
}));

export const journeyTaskCompletionsRelations = relations(journeyTaskCompletions, ({ one }) => ({
  user: one(users, {
    fields: [journeyTaskCompletions.userId],
    references: [users.id],
  }),
}));

export const journeyStageCompletionsRelations = relations(journeyStageCompletions, ({ one }) => ({
  user: one(users, {
    fields: [journeyStageCompletions.userId],
    references: [users.id],
  }),
}));

export const ideaJourneyProgressRelations = relations(ideaJourneyProgress, ({ one }) => ({
  user: one(users, {
    fields: [ideaJourneyProgress.userId],
    references: [users.id],
  }),
  idea: one(ideas, {
    fields: [ideaJourneyProgress.ideaId],
    references: [ideas.id],
  }),
}));

// =============================================================================
// TYPES
// =============================================================================

export type StageKey =
  | "stage_1" | "stage_2" | "stage_3" | "stage_4" | "stage_5"
  | "stage_6" | "stage_7" | "stage_8" | "stage_9" | "stage_10";

export type TaskKey = "task_1" | "task_2" | "task_3" | "task_4" | "task_5";

export type TaskState = {
  [K in TaskKey]: boolean;
};

export type TasksCompletedState = {
  [K in StageKey]: TaskState;
};

export type FeatureKey = "ai" | "devmode" | "advanced" | "collaboration" | "meditation";

// Per-idea journey types (stages 2-10 only, stage 1 is global)
export type IdeaStageKey =
  | "stage_2" | "stage_3" | "stage_4" | "stage_5"
  | "stage_6" | "stage_7" | "stage_8" | "stage_9" | "stage_10";

export type IdeaTasksCompletedState = {
  [K in IdeaStageKey]: TaskState;
};

export type EvaluationResult = {
  passed: boolean;
  feedback: string;
  suggestions?: string[];
  evaluatedAt: string;
};

export type JourneyProgress = typeof journeyProgress.$inferSelect;
export type JourneyTaskCompletion = typeof journeyTaskCompletions.$inferSelect;
export type JourneyStageCompletion = typeof journeyStageCompletions.$inferSelect;
export type IdeaJourneyProgress = typeof ideaJourneyProgress.$inferSelect;

// =============================================================================
// HELPERS
// =============================================================================

function getDefaultTasksState(): TasksCompletedState {
  const defaultTaskState: TaskState = {
    task_1: false,
    task_2: false,
    task_3: false,
    task_4: false,
    task_5: false,
  };

  return {
    stage_1: { ...defaultTaskState },
    stage_2: { ...defaultTaskState },
    stage_3: { ...defaultTaskState },
    stage_4: { ...defaultTaskState },
    stage_5: { ...defaultTaskState },
    stage_6: { ...defaultTaskState },
    stage_7: { ...defaultTaskState },
    stage_8: { ...defaultTaskState },
    stage_9: { ...defaultTaskState },
    stage_10: { ...defaultTaskState },
  };
}

function getDefaultIdeaTasksState(): IdeaTasksCompletedState {
  const defaultTaskState: TaskState = {
    task_1: false,
    task_2: false,
    task_3: false,
    task_4: false,
    task_5: false,
  };

  return {
    stage_2: { ...defaultTaskState },
    stage_3: { ...defaultTaskState },
    stage_4: { ...defaultTaskState },
    stage_5: { ...defaultTaskState },
    stage_6: { ...defaultTaskState },
    stage_7: { ...defaultTaskState },
    stage_8: { ...defaultTaskState },
    stage_9: { ...defaultTaskState },
    stage_10: { ...defaultTaskState },
  };
}

export { getDefaultTasksState, getDefaultIdeaTasksState };
