"use client";

import { motion } from "framer-motion";
import { Check, Lock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageDefinition } from "@/lib/journey/constants";
import type { JourneyState } from "@/lib/journey/types";
import type { IdeaQuestState } from "@/lib/journey/idea-progress";

interface JourneyMapPanelProps {
  journeyState: JourneyState;
  stages: StageDefinition[];
  wandererPathStages: number;
  focusedStage: number;
  onStageSelect: (stageNumber: number) => void;
  ideaProgress: IdeaQuestState | null;
}

export function JourneyMapPanel({
  journeyState,
  stages,
  wandererPathStages,
  focusedStage,
  onStageSelect,
  ideaProgress,
}: JourneyMapPanelProps) {
  const isWanderer = journeyState.chosenPath === "wanderer";

  // Calculate completed tasks for a stage
  const getStageProgress = (stageNumber: number) => {
    // Stage 1 is global (from journeyState)
    if (stageNumber === 1) {
      const stageTasks = journeyState.tasksCompleted.stage_1;
      if (!stageTasks) return { completed: 0, total: 5 };
      const completed = Object.values(stageTasks).filter(Boolean).length;
      return { completed, total: 5 };
    }

    // Stages 2+ use idea progress if available
    if (ideaProgress) {
      const stageKey = `stage_${stageNumber}` as keyof typeof ideaProgress.tasksCompleted;
      const stageTasks = ideaProgress.tasksCompleted[stageKey];
      if (!stageTasks) return { completed: 0, total: 5 };
      const completed = Object.values(stageTasks).filter(Boolean).length;
      return { completed, total: 5 };
    }

    return { completed: 0, total: 5 };
  };

  // Check if a stage is completed
  const isStageCompleted = (stageNumber: number) => {
    const progress = getStageProgress(stageNumber);
    return progress.completed === progress.total;
  };

  // Check if a stage is accessible
  const isStageAccessible = (stageNumber: number) => {
    // Stage 1 is always accessible
    if (stageNumber === 1) return true;

    // Sorcerer stages (6-10) require subscription
    if (stageNumber > wandererPathStages && isWanderer) return false;

    // Must complete previous stage (or be at that stage)
    return stageNumber <= journeyState.currentStage;
  };

  // Split stages into two parts
  const wandererStages = stages.filter((s) => s.number <= wandererPathStages);
  const sorcererStages = stages.filter((s) => s.number > wandererPathStages);

  return (
    <div className="p-6">
      {/* Part I: Wanderer's Path */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">
          Part I: The Wanderer&apos;s Path
        </h3>

        <div className="relative">
          {/* Vertical progress line */}
          <div className="absolute left-[18px] top-4 bottom-4 w-px bg-white/10" />

          {/* Progress fill */}
          <motion.div
            className="absolute left-[18px] top-4 w-px bg-gradient-to-b from-green-500 to-cyan-500"
            initial={{ height: 0 }}
            animate={{
              height: `${Math.min(
                ((journeyState.currentStage - 1) / wandererPathStages) * 100,
                100
              )}%`,
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          {/* Stage nodes */}
          <div className="relative space-y-2">
            {wandererStages.map((stage) => {
              const progress = getStageProgress(stage.number);
              const isCompleted = isStageCompleted(stage.number);
              const isCurrent = stage.number === journeyState.currentStage;
              const isAccessible = isStageAccessible(stage.number);
              const isFocused = stage.number === focusedStage;

              return (
                <button
                  key={stage.id}
                  onClick={() => isAccessible && onStageSelect(stage.number)}
                  disabled={!isAccessible}
                  className={cn(
                    "group relative flex items-center w-full text-left rounded-lg py-3 px-3 transition-all duration-200",
                    isAccessible ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed opacity-50",
                    isFocused && "bg-white/10"
                  )}
                >
                  {/* Node */}
                  <div
                    className={cn(
                      "relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 z-10",
                      isCompleted
                        ? "bg-green-500/20 border-2 border-green-500"
                        : isCurrent
                          ? "bg-cyan-500/20 border-2 border-cyan-500"
                          : "bg-white/5 border border-white/20"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isCurrent ? "text-cyan-400" : "text-white/40"
                        )}
                      >
                        {stage.number}
                      </span>
                    )}

                    {/* Current stage pulse */}
                    {isCurrent && !isCompleted && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-cyan-500"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>

                  {/* Stage info */}
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium truncate",
                          isCurrent ? "text-cyan-400" : isCompleted ? "text-green-400" : "text-white"
                        )}
                      >
                        {stage.name}
                      </span>
                      {isFocused && (
                        <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-white/40 truncate">{stage.theme}</div>
                  </div>

                  {/* Progress indicator */}
                  <div className="text-xs text-white/40 shrink-0">
                    {progress.completed}/{progress.total}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Part II: Sorcerer's Ascension */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">
            Part II: The Sorcerer&apos;s Ascension
          </h3>
          {isWanderer && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Locked
            </span>
          )}
        </div>

        <div className="relative">
          {/* Vertical progress line */}
          <div className="absolute left-[18px] top-4 bottom-4 w-px bg-white/10" />

          {/* Progress fill for sorcerers */}
          {!isWanderer && (
            <motion.div
              className="absolute left-[18px] top-4 w-px bg-gradient-to-b from-purple-500 to-amber-500"
              initial={{ height: 0 }}
              animate={{
                height: `${Math.max(
                  0,
                  Math.min(
                    ((journeyState.currentStage - wandererPathStages - 1) /
                      sorcererStages.length) *
                      100,
                    100
                  )
                )}%`,
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}

          {/* Stage nodes */}
          <div className="relative space-y-2">
            {sorcererStages.map((stage) => {
              const progress = getStageProgress(stage.number);
              const isCompleted = isStageCompleted(stage.number);
              const isCurrent = stage.number === journeyState.currentStage;
              const isAccessible = isStageAccessible(stage.number);
              const isLocked = isWanderer;
              const isFocused = stage.number === focusedStage;

              return (
                <button
                  key={stage.id}
                  onClick={() => isAccessible && onStageSelect(stage.number)}
                  disabled={!isAccessible}
                  className={cn(
                    "group relative flex items-center w-full text-left rounded-lg py-3 px-3 transition-all duration-200",
                    isAccessible ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed",
                    isLocked && "opacity-40",
                    isFocused && "bg-white/10"
                  )}
                >
                  {/* Node */}
                  <div
                    className={cn(
                      "relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 z-10",
                      isLocked
                        ? "bg-white/5 border border-white/10"
                        : isCompleted
                          ? "bg-purple-500/20 border-2 border-purple-500"
                          : isCurrent
                            ? "bg-amber-500/20 border-2 border-amber-500"
                            : "bg-white/5 border border-white/20"
                    )}
                  >
                    {isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-white/30" />
                    ) : isCompleted ? (
                      <Check className="w-4 h-4 text-purple-400" />
                    ) : (
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isCurrent ? "text-amber-400" : "text-white/40"
                        )}
                      >
                        {stage.number}
                      </span>
                    )}

                    {/* Current stage pulse */}
                    {isCurrent && !isCompleted && !isLocked && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-amber-500"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>

                  {/* Stage info */}
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium truncate",
                          isLocked
                            ? "text-white/40"
                            : isCurrent
                              ? "text-amber-400"
                              : isCompleted
                                ? "text-purple-400"
                                : "text-white"
                        )}
                      >
                        {stage.name}
                      </span>
                      {isFocused && !isLocked && (
                        <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-white/40 truncate">{stage.theme}</div>
                  </div>

                  {/* Progress indicator */}
                  {!isLocked && (
                    <div className="text-xs text-white/40 shrink-0">
                      {progress.completed}/{progress.total}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upgrade CTA for wanderers */}
        {isWanderer && (
          <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-amber-500/10 border border-purple-500/20">
            <p className="text-sm text-white/60 mb-2">
              Unlock the Sorcerer&apos;s Ascension to continue your journey and gain access to
              powerful features.
            </p>
            <a
              href="/dashboard/billing"
              className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Upgrade to Sorcerer
              <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
