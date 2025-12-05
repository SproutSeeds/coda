"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { JourneyState } from "@/lib/journey/types";
import { JOURNEY } from "@/lib/journey/constants";
import type { StageKey } from "@/lib/db/schema/journey";

interface JourneyProgressProps {
  journeyState: JourneyState;
  maxAccessibleStage: number;
}

export function JourneyProgress({
  journeyState,
  maxAccessibleStage,
}: JourneyProgressProps) {
  const isWanderer = journeyState.chosenPath === "wanderer";

  // Calculate completed tasks
  let completedTasks = 0;
  const totalTasks = maxAccessibleStage * JOURNEY.tasksPerStage;

  for (let stage = 1; stage <= maxAccessibleStage; stage++) {
    const stageKey = `stage_${stage}` as StageKey;
    const tasks = journeyState.tasksCompleted[stageKey];
    if (tasks) {
      completedTasks += Object.values(tasks).filter(Boolean).length;
    }
  }

  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate current stage mana progress
  const currentStageKey = `stage_${journeyState.currentStage}` as StageKey;
  const currentStageTasks = journeyState.tasksCompleted[currentStageKey];
  const currentStageCompleted = currentStageTasks
    ? Object.values(currentStageTasks).filter(Boolean).length
    : 0;
  const stageManaPercent = (currentStageCompleted / JOURNEY.tasksPerStage) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {/* Overall Progress Card */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Progress</span>
          <span className="text-sm text-muted-foreground">
            {completedTasks} / {totalTasks} tasks
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              isWanderer ? "bg-primary" : "bg-amber-500"
            )}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{progressPercent}% complete</span>
          <span>
            {isWanderer
              ? `${journeyState.crystallizedSand} scoops earned`
              : `${(journeyState.manaPoolUnlocked / 1000).toFixed(0)}k mana unlocked`}
          </span>
        </div>
      </div>

      {/* Current Stage Progress Card */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Stage {journeyState.currentStage} Progress
          </span>
          <span className="text-sm text-muted-foreground">
            {currentStageCompleted} / {JOURNEY.tasksPerStage} tasks
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stageManaPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              isWanderer ? "bg-primary" : "bg-amber-500"
            )}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Mana: {currentStageCompleted * JOURNEY.manaPerTask} / {JOURNEY.manaPerStage}</span>
          <span>
            {currentStageCompleted === JOURNEY.tasksPerStage
              ? "Stage complete!"
              : `${JOURNEY.tasksPerStage - currentStageCompleted} tasks remaining`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
