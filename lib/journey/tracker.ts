/**
 * Journey Progress Tracker
 *
 * This module provides a simple interface for server actions to report
 * user actions that may complete journey tasks.
 *
 * Key principle: Each task is one-time completion. Once done, it's done.
 * Similar actions after completion are ignored.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ideas, ideaFeatures } from "@/lib/db/schema";
import { journeyProgress } from "@/lib/db/schema/journey";
import { completeTask, getJourneyProgress } from "./progress";
import { completeIdeaTask, rescanIdeaProgress } from "./idea-progress";
import { TUTORIAL_STEPS } from "./tutorial-steps";
import type { StageKey, TaskKey } from "@/lib/db/schema/journey";

// =============================================================================
// ACTION TYPES - Map user actions to potential task completions
// =============================================================================

export type TrackableAction =
  // Stage 1: Awakening
  | "visit_dashboard"
  | "create_idea"
  | "add_idea_notes"
  | "view_ideas_list"
  | "view_idea_detail"
  // Stage 2: First Sketch
  | "create_feature"
  | "add_feature_notes"
  | "add_feature_detail"
  // Stage 3: Taking Shape
  | "star_idea"
  | "star_feature"
  | "reorder_features"
  // Stage 4: The Craftsman's Mark
  | "complete_feature"
  | "edit_idea_title"
  | "edit_idea_notes"
  | "edit_feature"
  // Stage 5: The Connected Workshop
  | "super_star_idea"
  | "add_github_url"
  | "export_idea"
  | "convert_feature_to_idea"
  | "view_path_complete";

// =============================================================================
// TASK MAPPINGS - Define which actions can complete which tasks
// =============================================================================

type TaskMapping = {
  stage: number;
  task: number;
  /** Optional condition checker - if provided, must return true to complete */
  condition?: (userId: string, referenceId?: string) => Promise<boolean>;
};

/**
 * Maps actions to GLOBAL tasks they can complete.
 * Only Stage 1 is global (learning Coda basics).
 * Stages 2+ are tracked per-idea via trackPerIdeaProgress.
 */
const ACTION_TASK_MAP: Record<TrackableAction, TaskMapping[]> = {
  // Stage 1: Awakening (Global onboarding - one time only)
  visit_dashboard: [{ stage: 1, task: 1 }],
  create_idea: [{ stage: 1, task: 2 }], // First idea ever
  add_idea_notes: [{ stage: 1, task: 3 }],
  view_ideas_list: [{ stage: 1, task: 4, condition: checkHasAtLeastOneIdea }],
  view_idea_detail: [{ stage: 1, task: 5 }],

  // Stages 2+ are per-idea only - these entries are empty for global tracking
  // but the actions still trigger per-idea tracking via trackPerIdeaProgress
  create_feature: [],
  add_feature_notes: [],
  add_feature_detail: [],
  star_idea: [],
  star_feature: [],
  reorder_features: [],
  complete_feature: [],
  edit_idea_title: [],
  edit_idea_notes: [],
  edit_feature: [],
  super_star_idea: [],
  add_github_url: [],
  export_idea: [],
  convert_feature_to_idea: [],
  view_path_complete: [],
};

// =============================================================================
// CONDITION CHECKERS (Stage 1 only)
// =============================================================================

async function checkHasAtLeastOneIdea(userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(ideas)
    .where(and(eq(ideas.userId, userId), sql`${ideas.deletedAt} IS NULL`));
  return (result[0]?.count ?? 0) >= 1;
}

// =============================================================================
// MAIN TRACKING FUNCTION
// =============================================================================

export interface TrackResult {
  tracked: boolean;
  tasksCompleted: Array<{ stage: number; task: number }>;
  stagesCompleted: number[];
  error?: string;
}

/**
 * Track a user action and complete any applicable journey tasks.
 *
 * This is the main function that server actions should call after
 * successfully completing an action.
 *
 * @param userId - The user performing the action
 * @param action - The type of action performed
 * @param referenceId - Optional ID of the entity involved (e.g., idea ID, feature ID)
 */
export async function trackJourneyAction(
  userId: string,
  action: TrackableAction,
  referenceId?: string
): Promise<TrackResult> {
  try {
    // Get current journey state
    const state = await getJourneyProgress(userId);

    // If no path chosen, don't track
    if (!state || !state.chosenPath) {
      return { tracked: false, tasksCompleted: [], stagesCompleted: [] };
    }

    // Get potential task mappings for this action (global Stage 1 tasks)
    const mappings = ACTION_TASK_MAP[action] ?? [];

    const tasksCompleted: Array<{ stage: number; task: number }> = [];
    const stagesCompleted: number[] = [];

    // Check each potential task
    for (const mapping of mappings) {
      const { stage, task, condition } = mapping;

      // Skip if stage is not accessible
      if (stage > state.currentStage) continue;

      // Skip Sorcerer-only stages for Wanderers
      if (stage > 5 && state.chosenPath !== "sorcerer") continue;

      // Check if task is already completed
      const stageKey = `stage_${stage}` as StageKey;
      const taskKey = `task_${task}` as TaskKey;
      if (state.tasksCompleted[stageKey]?.[taskKey]) continue;

      // Check condition if present
      if (condition) {
        const conditionMet = await condition(userId, referenceId);
        if (!conditionMet) continue;
      }

      // Complete the task!
      const result = await completeTask(userId, stage, task, action, referenceId);

      if (result.taskCompleted) {
        tasksCompleted.push({ stage, task });

        if (result.stageCompleted) {
          stagesCompleted.push(stage);
        }
      }
    }

    // Tutorial Auto-Advance
    if (!state.tutorialSkipped && state.tutorialStep > 0) {
      const currentStepData = TUTORIAL_STEPS.find((s) => s.id === state.tutorialStep);
      if (currentStepData?.actionType === action) {
        const db = getDb();
        // Advance to next step
        await db
          .update(journeyProgress)
          .set({ tutorialStep: state.tutorialStep + 1 })
          .where(eq(journeyProgress.userId, userId));
      }
    }

    // Per-idea tracking (for stages 2+)
    // This is fire-and-forget - we don't need to await or care about result
    if (referenceId) {
      void trackPerIdeaProgress(action, referenceId);
    }

    return {
      tracked: true,
      tasksCompleted,
      stagesCompleted,
    };
  } catch (error) {
    console.error("[Journey Tracker] Error tracking action:", error);
    return {
      tracked: false,
      tasksCompleted: [],
      stagesCompleted: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Convenience function to track without awaiting result.
 * Use this when you don't need to know if tracking succeeded.
 */
export function trackJourneyActionAsync(
  userId: string,
  action: TrackableAction,
  referenceId?: string
): void {
  void trackJourneyAction(userId, action, referenceId);
}

// =============================================================================
// PER-IDEA TRACKING
// =============================================================================

/**
 * Per-idea quest task mapping. Maps actions to tasks for stages 2-10.
 * Stage 1 is global-only (learning Coda basics).
 */
const PER_IDEA_TASK_MAP: Partial<Record<TrackableAction, { stage: number; task: number }[]>> = {
  // Stage 2: First Sketch
  create_feature: [
    { stage: 2, task: 1 }, // Break it down
    { stage: 2, task: 2 }, // And another (count handled by rescan)
    { stage: 2, task: 5 }, // Shape takes hold (count handled by rescan)
    { stage: 3, task: 3 }, // Workshop grows - 5+ features (count handled by rescan)
  ],
  add_feature_notes: [
    { stage: 2, task: 3 }, // Describe the piece
    { stage: 3, task: 5 }, // Foundation set - all features have notes (checked by rescan)
  ],
  add_feature_detail: [
    { stage: 2, task: 4 }, // Go deeper
    { stage: 3, task: 4 }, // Structure emerges - detail sections
  ],

  // Stage 3: Taking Shape
  star_feature: [{ stage: 3, task: 1 }], // Mark what matters
  reorder_features: [{ stage: 3, task: 2 }], // Arrange your thoughts

  // Stage 4: The Craftsman's Mark
  complete_feature: [{ stage: 4, task: 1 }], // First completion (task_5 caught by rescan)
  edit_idea_title: [{ stage: 4, task: 2 }], // Refine the vision
  edit_idea_notes: [{ stage: 4, task: 3 }], // Deepen the description
  edit_feature: [{ stage: 4, task: 4 }], // Polish a facet

  // Stage 5: The Connected Workshop
  super_star_idea: [{ stage: 5, task: 1 }], // Elevate importance
  add_github_url: [{ stage: 5, task: 2 }], // Link to the world
  export_idea: [{ stage: 5, task: 3 }], // Preserve your work
  view_path_complete: [{ stage: 5, task: 5 }], // Foundation complete
};

/**
 * Track progress for a specific idea's journey.
 * This resolves the ideaId from the referenceId and updates per-idea tasks.
 */
async function trackPerIdeaProgress(action: TrackableAction, referenceId: string): Promise<void> {
  try {
    const mappings = PER_IDEA_TASK_MAP[action];
    if (!mappings || mappings.length === 0) return;

    // Resolve the ideaId from the referenceId
    // referenceId might be an idea ID or a feature ID
    const ideaId = await resolveIdeaId(referenceId);
    if (!ideaId) return;

    // Complete each mapped task
    for (const { stage, task } of mappings) {
      await completeIdeaTask(ideaId, stage, task);
    }

    // Also rescan the idea to catch state-based completions
    // (like "3+ features" or "all features have notes")
    await rescanIdeaProgress(ideaId);
  } catch (error) {
    // Silent fail - per-idea tracking is non-critical
    console.error("[Journey Tracker] Per-idea tracking error:", error);
  }
}

/**
 * Resolve an ideaId from a referenceId.
 * If referenceId is a feature ID, look up its parent idea.
 * If referenceId is already an idea ID, return it.
 */
async function resolveIdeaId(referenceId: string): Promise<string | null> {
  const db = getDb();

  // First, check if it's an idea ID
  const [idea] = await db
    .select({ id: ideas.id })
    .from(ideas)
    .where(eq(ideas.id, referenceId))
    .limit(1);

  if (idea) return idea.id;

  // Check if it's a feature ID
  const [feature] = await db
    .select({ ideaId: ideaFeatures.ideaId })
    .from(ideaFeatures)
    .where(eq(ideaFeatures.id, referenceId))
    .limit(1);

  if (feature) return feature.ideaId;

  return null;
}
