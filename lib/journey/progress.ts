/**
 * Journey Progress Utilities
 *
 * Functions for tracking and updating user progress through The Path.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  journeyProgress,
  journeyTaskCompletions,
  journeyStageCompletions,
  users,
  type StageKey,
  type TaskKey,
  type TasksCompletedState,
  type FeatureKey,
  getDefaultTasksState,
} from "@/lib/db/schema";
import {
  JOURNEY,
  WANDERER_REWARDS,
  SORCERER_REWARDS,
  getStageByNumber,
  isWandererStage,
  getFeatureUnlockForStage,
} from "./constants";
import type {
  ChosenPath,
  JourneyState,
  TaskCompletionResult,
  StageCompletionResult,
  PathSelectionResult,
} from "./types";

// =============================================================================
// GET PROGRESS
// =============================================================================

/**
 * Get or create journey progress for a user
 */
export async function getJourneyProgress(userId: string): Promise<JourneyState | null> {
  const db = getDb();

  // Get user and journey progress
  let user;
  try {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
  } catch (err) {
    console.error("[Journey] Failed to load user for progress", err);
    return null;
  }

  if (!user) return null;

  // Get or create journey progress
  let progress;
  try {
    [progress] = await db
      .select()
      .from(journeyProgress)
      .where(eq(journeyProgress.userId, userId))
      .limit(1);
  } catch (err) {
    console.error("[Journey] Failed to load journey progress", err);
    return null;
  }

  if (!progress) {
    // Create initial progress record
    try {
      const [newProgress] = await db
        .insert(journeyProgress)
        .values({
          userId,
          tasksCompleted: getDefaultTasksState(),
        })
        .returning();
      progress = newProgress;
    } catch (err) {
      console.error("[Journey] Failed to initialize journey progress", err);
      return null;
    }
  }

  return {
    userId,
    chosenPath: user.chosenPath as ChosenPath | null,
    currentStage: progress.currentStage,
    totalMana: progress.totalMana,
    crystallizedSand: progress.crystallizedSand,
    trialDaysEarned: progress.crystallizedSand * WANDERER_REWARDS.daysPerScoop,
    trialStartedAt: user.pathChosenAt,
    trialEndsAt: user.trialEndsAt,
    manaPoolUnlocked: progress.manaPoolUnlocked,
    bonusManaEarned: progress.bonusManaEarned,
    featuresUnlocked: progress.featuresUnlocked as FeatureKey[],
    meditationUnlocked: progress.meditationUnlocked,
    meditationLevel: progress.meditationLevel,
    tasksCompleted: progress.tasksCompleted as TasksCompletedState,
    stagesCompleted: progress.stagesCompleted as Record<string, string>,
    wandererPathCompleted: progress.wandererPathCompletedAt !== null,
    sorcererAscensionCompleted: progress.sorcererAscensionCompletedAt !== null,
    tutorialStep: progress.tutorialStep,
    tutorialSkipped: progress.tutorialSkipped,
  };
}

// =============================================================================
// PATH SELECTION
// =============================================================================

/**
 * Set the user's chosen path (wanderer or sorcerer)
 */
export async function selectPath(
  userId: string,
  path: ChosenPath
): Promise<PathSelectionResult> {
  const db = getDb();

  const now = new Date();
  let trialEndsAt: Date | undefined;

  // For wanderers, set initial trial end date (0 days - they must earn time)
  // Trial starts at 0 and grows as they complete stages
  if (path === "wanderer") {
    trialEndsAt = now; // Starts with 0 days, must earn sand
  }

  // Update user record
  await db
    .update(users)
    .set({
      chosenPath: path,
      pathChosenAt: now,
      trialEndsAt: trialEndsAt ?? null,
    })
    .where(eq(users.id, userId));

  // Ensure journey progress exists
  const [existing] = await db
    .select()
    .from(journeyProgress)
    .where(eq(journeyProgress.userId, userId))
    .limit(1);

  if (!existing) {
    await db.insert(journeyProgress).values({
      userId,
      tasksCompleted: getDefaultTasksState(),
    });
  }

  return {
    success: true,
    path,
    trialEndsAt,
    message:
      path === "wanderer"
        ? "Your journey begins. Earn time through creation."
        : "The Sorcerer's power awaits. Walk the path to unlock it.",
  };
}

// =============================================================================
// TASK COMPLETION
// =============================================================================

/**
 * Complete a task and award rewards
 */
export async function completeTask(
  userId: string,
  stageNumber: number,
  taskNumber: number,
  actionType: string,
  actionReferenceId?: string
): Promise<TaskCompletionResult> {
  const db = getDb();

  const stageKey = `stage_${stageNumber}` as StageKey;
  const taskKey = `task_${taskNumber}` as TaskKey;

  // Get current progress
  const state = await getJourneyProgress(userId);
  if (!state) {
    return {
      success: false,
      taskCompleted: false,
      stageCompleted: false,
      manaEarned: 0,
      sandEarned: 0,
      manaPoolUnlocked: 0,
      bonusManaEarned: 0,
      featureUnlocked: null,
      message: "User not found",
    };
  }

  // Check if task already completed
  if (state.tasksCompleted[stageKey]?.[taskKey]) {
    return {
      success: true,
      taskCompleted: false,
      stageCompleted: false,
      manaEarned: 0,
      sandEarned: 0,
      manaPoolUnlocked: 0,
      bonusManaEarned: 0,
      featureUnlocked: null,
      message: "Task already completed",
    };
  }

  // Check if stage is accessible
  if (stageNumber > state.currentStage) {
    return {
      success: false,
      taskCompleted: false,
      stageCompleted: false,
      manaEarned: 0,
      sandEarned: 0,
      manaPoolUnlocked: 0,
      bonusManaEarned: 0,
      featureUnlocked: null,
      message: "Stage not yet unlocked",
    };
  }

  // Check if sorcerer stage requires subscription
  if (!isWandererStage(stageNumber) && state.chosenPath !== "sorcerer") {
    return {
      success: false,
      taskCompleted: false,
      stageCompleted: false,
      manaEarned: 0,
      sandEarned: 0,
      manaPoolUnlocked: 0,
      bonusManaEarned: 0,
      featureUnlocked: null,
      message: "Sorcerer subscription required for this stage",
    };
  }

  // Award mana for task completion
  const manaEarned = JOURNEY.manaPerTask;

  // Update tasks completed
  const updatedTasks = { ...state.tasksCompleted };
  updatedTasks[stageKey] = { ...updatedTasks[stageKey], [taskKey]: true };

  // Record task completion - use try-catch to handle race conditions
  // where JSONB check passes but row already exists
  try {
    await db.insert(journeyTaskCompletions).values({
      userId,
      stage: stageNumber,
      task: taskNumber,
      manaEarned,
      sandEarned: 0,
      actionType,
      actionReferenceId,
    });
  } catch (error) {
    // Check if this is a unique constraint violation (task already completed)
    // The constraint name may be in the error cause or message
    const isUniqueViolation =
      error instanceof Error &&
      (error.message.includes("journey_task_unique") ||
        error.message.includes("duplicate key") ||
        (error.cause instanceof Error &&
          ((error.cause as { code?: string }).code === "23505" ||
            error.cause.message.includes("journey_task_unique"))));

    if (isUniqueViolation) {
      return {
        success: true,
        taskCompleted: false,
        stageCompleted: false,
        manaEarned: 0,
        sandEarned: 0,
        manaPoolUnlocked: 0,
        bonusManaEarned: 0,
        featureUnlocked: null,
        message: "Task already completed",
      };
    }
    throw error; // Re-throw other errors
  }

  // Update progress
  await db
    .update(journeyProgress)
    .set({
      tasksCompleted: updatedTasks,
      totalMana: state.totalMana + manaEarned,
      updatedAt: new Date(),
    })
    .where(eq(journeyProgress.userId, userId));

  // Check if stage is now complete
  const stageTasksComplete = Object.values(updatedTasks[stageKey]).every(Boolean);

  let stageCompletionResult: StageCompletionResult | null = null;
  if (stageTasksComplete && !state.stagesCompleted[stageKey]) {
    stageCompletionResult = await completeStage(userId, stageNumber);
  }

  return {
    success: true,
    taskCompleted: true,
    stageCompleted: stageCompletionResult?.success ?? false,
    manaEarned,
    sandEarned: stageCompletionResult?.sandGranted ?? 0,
    manaPoolUnlocked: stageCompletionResult?.manaPoolGranted ?? 0,
    bonusManaEarned: stageCompletionResult?.bonusManaGranted ?? 0,
    featureUnlocked: stageCompletionResult?.featureUnlocked ?? null,
    message: stageCompletionResult
      ? `Stage ${stageNumber} complete!`
      : "Task complete! Mana manifests from within.",
  };
}

// =============================================================================
// STAGE COMPLETION
// =============================================================================

/**
 * Complete a stage and award rewards
 */
export async function completeStage(
  userId: string,
  stageNumber: number
): Promise<StageCompletionResult> {
  const db = getDb();

  const state = await getJourneyProgress(userId);
  if (!state) {
    return {
      success: false,
      stageNumber,
      stageName: "",
      sandGranted: 0,
      manaPoolGranted: 0,
      bonusManaGranted: 0,
      featureUnlocked: null,
      isWandererPathComplete: false,
      isSorcererAscensionComplete: false,
    };
  }

  const stage = getStageByNumber(stageNumber);
  if (!stage) {
    return {
      success: false,
      stageNumber,
      stageName: "",
      sandGranted: 0,
      manaPoolGranted: 0,
      bonusManaGranted: 0,
      featureUnlocked: null,
      isWandererPathComplete: false,
      isSorcererAscensionComplete: false,
    };
  }

  const stageKey = `stage_${stageNumber}` as StageKey;
  const isWanderer = state.chosenPath === "wanderer";
  const isSorcerer = state.chosenPath === "sorcerer";

  // Calculate rewards based on path and stage
  let sandGranted = 0;
  let manaPoolGranted = 0;
  let bonusManaGranted = 0;
  let featureUnlocked: FeatureKey | null = null;

  if (isWandererStage(stageNumber)) {
    // Stages 1-5: Wanderers get sand, Sorcerers get mana pool
    if (isWanderer) {
      sandGranted = WANDERER_REWARDS.sandPerStage;
    } else if (isSorcerer) {
      manaPoolGranted = SORCERER_REWARDS.manaPoolPerStage;
    }
  } else {
    // Stages 6-10: Sorcerers only, get bonus mana + feature unlock
    if (isSorcerer) {
      bonusManaGranted = SORCERER_REWARDS.bonusManaPerStage;
      featureUnlocked = getFeatureUnlockForStage(stageNumber);
    }
  }

  // Record stage completion
  await db.insert(journeyStageCompletions).values({
    userId,
    stage: stageNumber,
    sandGranted,
    manaPoolGranted,
    bonusManaGranted,
    featureUnlocked,
  });

  // Update progress
  const updatedStagesCompleted = {
    ...state.stagesCompleted,
    [stageKey]: new Date().toISOString(),
  };

  const updatedFeaturesUnlocked = featureUnlocked
    ? [...state.featuresUnlocked, featureUnlocked]
    : state.featuresUnlocked;

  const isWandererPathComplete = stageNumber === 5;
  const isSorcererAscensionComplete = stageNumber === 10;

  await db
    .update(journeyProgress)
    .set({
      currentStage: Math.min(stageNumber + 1, JOURNEY.totalStages),
      crystallizedSand: state.crystallizedSand + sandGranted,
      manaPoolUnlocked: state.manaPoolUnlocked + manaPoolGranted,
      bonusManaEarned: state.bonusManaEarned + bonusManaGranted,
      featuresUnlocked: updatedFeaturesUnlocked,
      stagesCompleted: updatedStagesCompleted,
      meditationUnlocked: featureUnlocked === "meditation" ? true : state.meditationUnlocked,
      wandererPathCompletedAt: isWandererPathComplete ? new Date() : undefined,
      sorcererAscensionCompletedAt: isSorcererAscensionComplete ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(journeyProgress.userId, userId));

  // For wanderers, extend trial
  if (isWanderer && sandGranted > 0) {
    const daysToAdd = sandGranted * WANDERER_REWARDS.daysPerScoop;
    const currentTrialEnd = state.trialEndsAt ?? new Date();
    const newTrialEnd = new Date(currentTrialEnd);
    newTrialEnd.setDate(newTrialEnd.getDate() + daysToAdd);

    await db
      .update(users)
      .set({ trialEndsAt: newTrialEnd })
      .where(eq(users.id, userId));
  }

  return {
    success: true,
    stageNumber,
    stageName: stage.name,
    sandGranted,
    manaPoolGranted,
    bonusManaGranted,
    featureUnlocked,
    isWandererPathComplete,
    isSorcererAscensionComplete,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a user can access a specific stage
 */
export function canAccessStage(state: JourneyState, stageNumber: number): boolean {
  // Must have chosen a path
  if (!state.chosenPath) return false;

  // Stage must be unlocked (at or before current stage)
  if (stageNumber > state.currentStage) return false;

  // Sorcerer stages require subscription
  if (!isWandererStage(stageNumber) && state.chosenPath !== "sorcerer") {
    return false;
  }

  return true;
}

/**
 * Get the next incomplete task for a user
 */
export function getNextTask(state: JourneyState): { stage: number; task: number } | null {
  for (let stage = 1; stage <= state.currentStage; stage++) {
    const stageKey = `stage_${stage}` as StageKey;

    // Skip sorcerer stages for wanderers
    if (!isWandererStage(stage) && state.chosenPath !== "sorcerer") {
      continue;
    }

    for (let task = 1; task <= JOURNEY.tasksPerStage; task++) {
      const taskKey = `task_${task}` as TaskKey;
      if (!state.tasksCompleted[stageKey]?.[taskKey]) {
        return { stage, task };
      }
    }
  }

  return null;
}

/**
 * Calculate stage progress (0-100)
 */
export function getStageProgress(state: JourneyState, stageNumber: number): number {
  const stageKey = `stage_${stageNumber}` as StageKey;
  const tasks = state.tasksCompleted[stageKey];
  if (!tasks) return 0;

  const completed = Object.values(tasks).filter(Boolean).length;
  return Math.round((completed / JOURNEY.tasksPerStage) * 100);
}

/**
 * Calculate overall journey progress (0-100)
 */
export function getOverallProgress(state: JourneyState): number {
  const maxStages = state.chosenPath === "sorcerer" ? JOURNEY.totalStages : JOURNEY.wandererPathStages;
  const totalTasks = maxStages * JOURNEY.tasksPerStage;

  let completed = 0;
  for (let stage = 1; stage <= maxStages; stage++) {
    const stageKey = `stage_${stage}` as StageKey;
    const tasks = state.tasksCompleted[stageKey];
    if (tasks) {
      completed += Object.values(tasks).filter(Boolean).length;
    }
  }

  return Math.round((completed / totalTasks) * 100);
}
