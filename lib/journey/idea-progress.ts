/**
 * Idea Journey Progress
 *
 * Per-idea quest tracking. Each idea has its own journey progress
 * from stages 2-10 (stage 1 is global onboarding).
 *
 * Key concept:
 * - Global journey_progress = "how to use Coda" (one-time)
 * - Per-idea idea_journey_progress = "building out this specific idea" (per idea)
 * - Rewards are global (earn once per stage across all ideas)
 * - Progress is per-idea (each idea tracks independently)
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  ideas,
  ideaFeatures,
  ideaJourneyProgress,
  type IdeaStageKey,
  type TaskKey,
  type TaskState,
  type IdeaTasksCompletedState,
  type IdeaJourneyProgress,
  getDefaultIdeaTasksState,
} from "@/lib/db/schema";
import { completeStage as completeGlobalStage } from "./progress";

// =============================================================================
// TYPES
// =============================================================================

export type IdeaQuestState = {
  ideaId: string;
  userId: string;
  currentStage: number;
  tasksCompleted: IdeaTasksCompletedState;
  stagesCompleted: Record<string, string>;
  lastEvaluationAt: Date | null;
};

export type ScannedTasks = {
  [K in IdeaStageKey]: TaskState;
};

// =============================================================================
// GET/CREATE PROGRESS
// =============================================================================

/**
 * Get or create idea journey progress for an idea.
 * Always rescans the idea to ensure progress is up-to-date.
 */
export async function getIdeaJourneyProgress(ideaId: string): Promise<IdeaQuestState | null> {
  const db = getDb();

  // Check idea exists and get userId
  const [idea] = await db
    .select({ id: ideas.id, userId: ideas.userId })
    .from(ideas)
    .where(and(eq(ideas.id, ideaId), sql`${ideas.deletedAt} IS NULL`))
    .limit(1);

  if (!idea) return null;

  // Get existing progress
  const [existingProgress] = await db
    .select()
    .from(ideaJourneyProgress)
    .where(eq(ideaJourneyProgress.ideaId, ideaId))
    .limit(1);

  if (!existingProgress) {
    // Create with auto-scanned initial state
    const scannedTasks = await scanIdeaForQuestProgress(ideaId);

    // Check for any completed stages in the scanned tasks
    const stagesCompleted: Record<string, string> = {};
    let currentStage = 2;

    for (let stage = 2; stage <= 10; stage++) {
      const stageKey = `stage_${stage}` as IdeaStageKey;
      const stageTasks = scannedTasks[stageKey];
      const allTasksComplete = stageTasks && Object.values(stageTasks).every(Boolean);

      if (allTasksComplete) {
        stagesCompleted[stageKey] = new Date().toISOString();
        if (stage === currentStage && stage < 10) {
          currentStage = stage + 1;
        }
      }
    }

    const [newProgress] = await db
      .insert(ideaJourneyProgress)
      .values({
        ideaId,
        userId: idea.userId,
        currentStage,
        tasksCompleted: scannedTasks,
        stagesCompleted,
      })
      .returning();

    return {
      ideaId: newProgress.ideaId,
      userId: newProgress.userId,
      currentStage: newProgress.currentStage,
      tasksCompleted: newProgress.tasksCompleted as IdeaTasksCompletedState,
      stagesCompleted: newProgress.stagesCompleted as Record<string, string>,
      lastEvaluationAt: newProgress.lastEvaluationAt,
    };
  }

  // Existing progress found - rescan to update
  return rescanIdeaProgress(ideaId);
}

// =============================================================================
// AUTO-SCAN LOGIC
// =============================================================================

/**
 * Scan an idea's current state and determine which quest tasks are already complete.
 *
 * This is called when:
 * 1. First time selecting an idea in Quest Hub
 * 2. User requests a rescan of their idea
 *
 * Some tasks can only be detected by their current state (e.g., "has 3+ features"),
 * while others require being tracked when they happen (e.g., "edit a feature").
 */
export async function scanIdeaForQuestProgress(ideaId: string): Promise<ScannedTasks> {
  const db = getDb();
  const tasks = getDefaultIdeaTasksState();

  // Fetch idea with features
  const [idea] = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      notes: ideas.notes,
      starred: ideas.starred,
      superStarred: ideas.superStarred,
      githubUrl: ideas.githubUrl,
    })
    .from(ideas)
    .where(and(eq(ideas.id, ideaId), sql`${ideas.deletedAt} IS NULL`))
    .limit(1);

  if (!idea) return tasks;

  // Fetch all features for this idea
  const features = await db
    .select({
      id: ideaFeatures.id,
      title: ideaFeatures.title,
      notes: ideaFeatures.notes,
      detail: ideaFeatures.detail,
      detailSections: ideaFeatures.detailSections,
      starred: ideaFeatures.starred,
      completed: ideaFeatures.completed,
    })
    .from(ideaFeatures)
    .where(and(eq(ideaFeatures.ideaId, ideaId), sql`${ideaFeatures.deletedAt} IS NULL`));

  const featureCount = features.length;
  const completedCount = features.filter(f => f.completed).length;
  const featuresWithNotes = features.filter(f => f.notes && f.notes.trim().length > 0);
  const featuresWithDetail = features.filter(f => f.detail && f.detail.trim().length > 0);
  const featuresWithStars = features.filter(f => f.starred);
  const featuresWithSections = features.filter(f =>
    f.detailSections && Array.isArray(f.detailSections) && f.detailSections.length > 0
  );

  // ----- Stage 2: First Sketch -----
  // task_1: Break it down (add first feature)
  tasks.stage_2.task_1 = featureCount >= 1;
  // task_2: And another (add second feature)
  tasks.stage_2.task_2 = featureCount >= 2;
  // task_3: Describe the piece (add notes to a feature)
  tasks.stage_2.task_3 = featuresWithNotes.length >= 1;
  // task_4: Go deeper (add detail to a feature)
  tasks.stage_2.task_4 = featuresWithDetail.length >= 1;
  // task_5: Shape takes hold (3+ features)
  tasks.stage_2.task_5 = featureCount >= 3;

  // ----- Stage 3: Taking Shape -----
  // task_1: Mark what matters (star a feature)
  tasks.stage_3.task_1 = featuresWithStars.length >= 1;
  // task_2: Arrange your thoughts (reorder features) - can't detect, marked on action
  tasks.stage_3.task_2 = false;
  // task_3: Workshop grows (5+ features on THIS idea)
  tasks.stage_3.task_3 = featureCount >= 5;
  // task_4: Structure emerges (add detail sections)
  tasks.stage_3.task_4 = featuresWithSections.length >= 1;
  // task_5: Foundation set (all features have notes)
  tasks.stage_3.task_5 = featureCount > 0 && featuresWithNotes.length === featureCount;

  // ----- Stage 4: The Craftsman's Mark -----
  // task_1: First completion (mark a feature complete)
  tasks.stage_4.task_1 = completedCount >= 1;
  // task_2: Refine the vision (edit idea title) - can't detect, marked on action
  tasks.stage_4.task_2 = false;
  // task_3: Deepen the description (edit idea notes) - can't detect, marked on action
  tasks.stage_4.task_3 = false;
  // task_4: Polish a facet (edit a feature) - can't detect, marked on action
  tasks.stage_4.task_4 = false;
  // task_5: Steady progress (complete a second feature)
  tasks.stage_4.task_5 = completedCount >= 2;

  // ----- Stage 5: The Connected Workshop -----
  // task_1: Elevate importance (super-star the idea)
  tasks.stage_5.task_1 = idea.superStarred === true;
  // task_2: Link to the world (add GitHub URL)
  tasks.stage_5.task_2 = !!idea.githubUrl && idea.githubUrl.trim().length > 0;
  // task_3: Preserve your work (export as JSON) - can only be marked on action
  tasks.stage_5.task_3 = false;
  // task_4: Ready for review (all features have detail)
  tasks.stage_5.task_4 = featureCount > 0 && featuresWithDetail.length === featureCount;
  // task_5: Foundation complete (view completion summary) - marked on action
  tasks.stage_5.task_5 = false;

  // ----- Stages 6-10: Sorcerer Path (mostly action-based) -----
  // These are typically AI/DevMode interactions that must be tracked when they happen
  // Stage 6: The Oracle's Gift (AI interactions)
  // Stage 7: The Codex Opens (DevMode/Runner)
  // Stage 8: The Scribe's Discipline (Documentation quality)
  // Stage 9: The Circle Expands (Collaboration - future)
  // Stage 10: Ascension (Final review)

  // All stage 6-10 tasks remain false - they're action-based

  return tasks;
}

// =============================================================================
// UPDATE PROGRESS
// =============================================================================

/**
 * Rescan an idea and update its quest progress
 */
export async function rescanIdeaProgress(ideaId: string): Promise<IdeaQuestState | null> {
  const db = getDb();

  // Get existing progress
  const [progress] = await db
    .select()
    .from(ideaJourneyProgress)
    .where(eq(ideaJourneyProgress.ideaId, ideaId))
    .limit(1);

  if (!progress) {
    // Create new if doesn't exist
    return getIdeaJourneyProgress(ideaId);
  }

  // Scan current state
  const scannedTasks = await scanIdeaForQuestProgress(ideaId);

  // Merge: keep any previously completed tasks that can't be detected by scan
  // (like edit actions, export, etc.)
  const existingTasks = progress.tasksCompleted as IdeaTasksCompletedState;
  const mergedTasks = mergeTasks(existingTasks, scannedTasks);

  // Check for stage completions
  const stagesCompleted = { ...(progress.stagesCompleted as Record<string, string>) };
  let currentStage = progress.currentStage;
  const newlyCompletedStages: number[] = [];

  // Check each stage for completion
  for (let stage = 2; stage <= 10; stage++) {
    const stageKey = `stage_${stage}` as IdeaStageKey;
    const stageTasks = mergedTasks[stageKey];
    const allTasksComplete = stageTasks && Object.values(stageTasks).every(Boolean);

    if (allTasksComplete && !stagesCompleted[stageKey]) {
      // Stage just completed
      stagesCompleted[stageKey] = new Date().toISOString();
      newlyCompletedStages.push(stage);
      // Advance to next stage if this was the current stage
      if (stage === currentStage && stage < 10) {
        currentStage = stage + 1;
      }
    }
  }

  // Update per-idea progress
  await db
    .update(ideaJourneyProgress)
    .set({
      tasksCompleted: mergedTasks,
      stagesCompleted,
      currentStage,
      updatedAt: new Date(),
    })
    .where(eq(ideaJourneyProgress.ideaId, ideaId));

  // Grant global rewards for newly completed stages (sand/mana)
  // This is fire-and-forget since rewards are a bonus, not critical
  for (const stageNum of newlyCompletedStages) {
    void completeGlobalStage(progress.userId, stageNum);
  }

  return {
    ideaId: progress.ideaId,
    userId: progress.userId,
    currentStage,
    tasksCompleted: mergedTasks,
    stagesCompleted,
    lastEvaluationAt: progress.lastEvaluationAt,
  };
}

/**
 * Merge existing tasks with newly scanned tasks.
 * A task is considered complete if EITHER the existing state OR the scan shows it complete.
 */
function mergeTasks(existing: IdeaTasksCompletedState, scanned: ScannedTasks): IdeaTasksCompletedState {
  const result = { ...existing };

  for (const stageKey of Object.keys(scanned) as IdeaStageKey[]) {
    result[stageKey] = {
      task_1: existing[stageKey]?.task_1 || scanned[stageKey].task_1,
      task_2: existing[stageKey]?.task_2 || scanned[stageKey].task_2,
      task_3: existing[stageKey]?.task_3 || scanned[stageKey].task_3,
      task_4: existing[stageKey]?.task_4 || scanned[stageKey].task_4,
      task_5: existing[stageKey]?.task_5 || scanned[stageKey].task_5,
    };
  }

  return result;
}

/**
 * Mark a specific task as complete for an idea's journey
 */
export async function completeIdeaTask(
  ideaId: string,
  stageNumber: number,
  taskNumber: number
): Promise<boolean> {
  if (stageNumber < 2 || stageNumber > 10) return false;
  if (taskNumber < 1 || taskNumber > 5) return false;

  const db = getDb();
  const stageKey = `stage_${stageNumber}` as IdeaStageKey;
  const taskKey = `task_${taskNumber}` as TaskKey;

  // Get existing progress
  let [progress] = await db
    .select()
    .from(ideaJourneyProgress)
    .where(eq(ideaJourneyProgress.ideaId, ideaId))
    .limit(1);

  if (!progress) {
    // Create if doesn't exist
    const state = await getIdeaJourneyProgress(ideaId);
    if (!state) return false;

    [progress] = await db
      .select()
      .from(ideaJourneyProgress)
      .where(eq(ideaJourneyProgress.ideaId, ideaId))
      .limit(1);
  }

  // Update the specific task
  const tasks = progress.tasksCompleted as IdeaTasksCompletedState;
  if (tasks[stageKey]?.[taskKey]) {
    // Already complete
    return true;
  }

  tasks[stageKey] = {
    ...tasks[stageKey],
    [taskKey]: true,
  };

  // Check if this stage is now complete
  const stagesCompleted = { ...(progress.stagesCompleted as Record<string, string>) };
  let currentStage = progress.currentStage;
  let stageJustCompleted = false;

  const allTasksComplete = Object.values(tasks[stageKey]).every(Boolean);
  if (allTasksComplete && !stagesCompleted[stageKey]) {
    stagesCompleted[stageKey] = new Date().toISOString();
    stageJustCompleted = true;
    if (stageNumber === currentStage && stageNumber < 10) {
      currentStage = stageNumber + 1;
    }
  }

  await db
    .update(ideaJourneyProgress)
    .set({
      tasksCompleted: tasks,
      stagesCompleted,
      currentStage,
      updatedAt: new Date(),
    })
    .where(eq(ideaJourneyProgress.ideaId, ideaId));

  // Grant global rewards if stage was just completed
  if (stageJustCompleted) {
    void completeGlobalStage(progress.userId, stageNumber);
  }

  return true;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate stage progress for an idea (0-100)
 */
export function getIdeaStageProgress(state: IdeaQuestState, stageNumber: number): number {
  if (stageNumber < 2 || stageNumber > 10) return 0;

  const stageKey = `stage_${stageNumber}` as IdeaStageKey;
  const tasks = state.tasksCompleted[stageKey];
  if (!tasks) return 0;

  const completed = Object.values(tasks).filter(Boolean).length;
  return Math.round((completed / 5) * 100);
}

/**
 * Get total completed tasks for an idea across all stages
 */
export function getIdeaTotalProgress(state: IdeaQuestState): { completed: number; total: number } {
  let completed = 0;
  const total = 9 * 5; // 9 stages (2-10) * 5 tasks each = 45 tasks

  for (let stage = 2; stage <= 10; stage++) {
    const stageKey = `stage_${stage}` as IdeaStageKey;
    const tasks = state.tasksCompleted[stageKey];
    if (tasks) {
      completed += Object.values(tasks).filter(Boolean).length;
    }
  }

  return { completed, total };
}
