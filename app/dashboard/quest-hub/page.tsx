import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { users, ideas, ideaFeatures, getDefaultTasksState } from "@/lib/db/schema";
import { getJourneyProgress } from "@/lib/journey/progress";
import { getIdeaJourneyProgress } from "@/lib/journey/idea-progress";
import { ALL_STAGES, JOURNEY } from "@/lib/journey/constants";
import { trackJourneyAction } from "@/lib/journey/tracker";
import { QuestHubClient } from "./quest-hub-client";
import type { IdeaSummary } from "../path/components/IdeaSelector";
import type { JourneyState } from "@/lib/journey/types";

const SELECTED_IDEA_COOKIE = "quest-hub-selected-idea";

// Force dynamic rendering to always get fresh journey state
export const dynamic = "force-dynamic";

export default async function QuestHubPage({
  searchParams,
}: {
  searchParams: Promise<{ idea?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check directly from users table to ensure we have the latest data
  const db = getDb();
  const [userRecord] = await db
    .select({ chosenPath: users.chosenPath })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!userRecord?.chosenPath) {
    // Path not chosen yet - redirect to choose path
    redirect("/choose-path");
  }

  // Fetch user's ideas for the selector
  const userIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      updatedAt: ideas.updatedAt,
    })
    .from(ideas)
    .where(and(eq(ideas.userId, user.id), sql`${ideas.deletedAt} IS NULL`))
    .orderBy(desc(ideas.updatedAt))
    .limit(50);

  // Get feature counts for each idea
  const ideaSummaries: IdeaSummary[] = await Promise.all(
    userIdeas.map(async (idea) => {
      const featureCounts = await db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where ${ideaFeatures.completed} = true)`,
        })
        .from(ideaFeatures)
        .where(and(eq(ideaFeatures.ideaId, idea.id), sql`${ideaFeatures.deletedAt} IS NULL`));

      return {
        id: idea.id,
        title: idea.title,
        updatedAt: idea.updatedAt,
        featureCount: featureCounts[0]?.total ?? 0,
        completedCount: featureCounts[0]?.completed ?? 0,
      };
    })
  );

  // Read cookie preferences
  const cookieStore = await cookies();
  const savedIdeaId = cookieStore.get(SELECTED_IDEA_COOKIE)?.value;

  // Determine selected idea (priority: URL param > cookie > most recent)
  let selectedIdeaId: string | null = null;
  if (params.idea && ideaSummaries.some((i) => i.id === params.idea)) {
    selectedIdeaId = params.idea;
  } else if (savedIdeaId && ideaSummaries.some((i) => i.id === savedIdeaId)) {
    selectedIdeaId = savedIdeaId;
  } else {
    selectedIdeaId = ideaSummaries[0]?.id ?? null;
  }

  // Fetch per-idea progress if an idea is selected
  let ideaProgress = null;
  if (selectedIdeaId) {
    ideaProgress = await getIdeaJourneyProgress(selectedIdeaId);
  }

  let journeyState;
  try {
    journeyState = await getJourneyProgress(user.id);
  } catch (error) {
    console.error("Error fetching journey progress:", error);
  }

  if (!journeyState) {
    // Create a minimal journey state since we know the path is chosen
    const defaultState: JourneyState = {
      userId: user.id,
      chosenPath: userRecord.chosenPath as "wanderer" | "sorcerer",
      currentStage: 1,
      totalMana: 0,
      crystallizedSand: 0,
      trialDaysEarned: 0,
      trialEndsAt: null,
      trialStartedAt: null,
      manaPoolUnlocked: 0,
      bonusManaEarned: 0,
      featuresUnlocked: [],
      meditationUnlocked: false,
      meditationLevel: 0,
      tasksCompleted: getDefaultTasksState(),
      stagesCompleted: {},
      wandererPathCompleted: false,
      sorcererAscensionCompleted: false,
      tutorialStep: 0,
      tutorialSkipped: false,
    };
    journeyState = defaultState;
  }

  // Track viewing the path page
  if (journeyState.currentStage > 5 || journeyState.stagesCompleted.stage_5) {
    void trackJourneyAction(user.id, "view_path_complete");
  }

  // Calculate overall completion percentage for dynamic tube coloring
  const totalTasks = JOURNEY.totalStages * 5; // 10 stages * 5 tasks each
  let completedTasks = 0;
  for (let stage = 1; stage <= JOURNEY.totalStages; stage++) {
    const stageKey = `stage_${stage}` as keyof typeof journeyState.tasksCompleted;
    const stageTasks = journeyState.tasksCompleted[stageKey];
    if (stageTasks) {
      completedTasks += Object.values(stageTasks).filter(Boolean).length;
    }
  }
  const completionPercent = Math.round((completedTasks / totalTasks) * 100);

  return (
    <QuestHubClient
      journeyState={journeyState}
      stages={ALL_STAGES}
      totalStages={JOURNEY.totalStages}
      wandererPathStages={JOURNEY.wandererPathStages}
      ideas={ideaSummaries}
      selectedIdeaId={selectedIdeaId}
      ideaProgress={ideaProgress}
      completionPercent={completionPercent}
    />
  );
}
