"use client";

import { motion } from "framer-motion";
import { Check, Circle, ChevronLeft, ChevronRight, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageDefinition } from "@/lib/journey/constants";
import type { JourneyState } from "@/lib/journey/types";
import type { IdeaQuestState } from "@/lib/journey/idea-progress";

interface CurrentQuestPanelProps {
  journeyState: JourneyState;
  stages: StageDefinition[];
  focusedStage: number;
  onStageChange: (stage: number) => void;
  ideaProgress: IdeaQuestState | null;
  totalStages: number;
  wandererPathStages: number;
}

export function CurrentQuestPanel({
  journeyState,
  stages,
  focusedStage,
  onStageChange,
  ideaProgress,
  totalStages,
  wandererPathStages,
}: CurrentQuestPanelProps) {
  const isWanderer = journeyState.chosenPath === "wanderer";
  const stage = stages.find((s) => s.number === focusedStage);

  if (!stage) {
    return (
      <div className="p-6 text-center text-white/40">
        Stage not found
      </div>
    );
  }

  const isSorcererStage = stage.number > wandererPathStages;
  const isLocked = isSorcererStage && isWanderer;
  // Note: isAccessible could be used to disable interactions in future
  const _isAccessible = stage.number <= journeyState.currentStage && !isLocked;
  void _isAccessible; // Suppress unused warning

  // Get task completion status
  const getTaskCompleted = (taskIndex: number) => {
    const taskKey = `task_${taskIndex + 1}` as "task_1" | "task_2" | "task_3" | "task_4" | "task_5";

    // Stage 1 is global (from journeyState)
    if (stage.number === 1) {
      const stageTasks = journeyState.tasksCompleted.stage_1;
      return stageTasks?.[taskKey] ?? false;
    }

    // Stages 2+ use idea progress
    if (ideaProgress) {
      const stageKey = `stage_${stage.number}` as keyof typeof ideaProgress.tasksCompleted;
      const stageTasks = ideaProgress.tasksCompleted[stageKey];
      return stageTasks?.[taskKey] ?? false;
    }

    return false;
  };

  // Calculate progress
  const completedCount = stage.tasks.filter((_, i) => getTaskCompleted(i)).length;
  const progressPercent = (completedCount / stage.tasks.length) * 100;

  // Navigation
  const canGoPrev = focusedStage > 1;
  const canGoNext = focusedStage < totalStages && (focusedStage < wandererPathStages || !isWanderer);

  return (
    <div className="p-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => canGoPrev && onStageChange(focusedStage - 1)}
          disabled={!canGoPrev}
          className={cn(
            "p-2 rounded-lg transition-colors",
            canGoPrev
              ? "hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
              : "text-white/20 cursor-not-allowed"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="text-xs text-white/40 uppercase tracking-wider">
            Stage {stage.number} of {isWanderer ? wandererPathStages : totalStages}
          </div>
        </div>

        <button
          onClick={() => canGoNext && onStageChange(focusedStage + 1)}
          disabled={!canGoNext}
          className={cn(
            "p-2 rounded-lg transition-colors",
            canGoNext
              ? "hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
              : "text-white/20 cursor-not-allowed"
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Stage Title */}
      <div className="text-center mb-6">
        <h2
          className={cn(
            "text-2xl font-bold mb-1",
            isLocked
              ? "text-white/40"
              : isSorcererStage
                ? "text-purple-400"
                : "text-cyan-400"
          )}
        >
          {stage.name}
        </h2>
        <p className="text-white/50 text-sm italic">{stage.theme}</p>
      </div>

      {/* Locked State */}
      {isLocked && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <Lock className="w-8 h-8 text-white/30" />
          </div>
          <p className="text-white/50 mb-4">
            This stage requires a Sorcerer subscription.
          </p>
          <a
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to Sorcerer
          </a>
        </div>
      )}

      {/* Progress Ring */}
      {!isLocked && (
        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-24">
            {/* Background ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={isSorcererStage ? "#a855f7" : "#22d3ee"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 42 * (1 - progressPercent / 100),
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {completedCount}/{stage.tasks.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {!isLocked && (
        <p className="text-white/60 text-sm text-center mb-6">{stage.description}</p>
      )}

      {/* Task List */}
      {!isLocked && (
        <div className="space-y-3">
          {stage.tasks.map((task, index) => {
            const isCompleted = getTaskCompleted(index);
            const isCurrentTask = !isCompleted && index === completedCount;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-colors",
                  isCompleted
                    ? "bg-white/5"
                    : isCurrentTask
                      ? "bg-white/10 border border-white/10"
                      : "opacity-50"
                )}
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    isCompleted
                      ? isSorcererStage
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-green-500/20 text-green-400"
                      : "border border-white/20"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3" />
                  ) : isCurrentTask ? (
                    <Circle className="w-3 h-3 text-white/40" />
                  ) : null}
                </div>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "font-medium text-sm",
                      isCompleted ? "text-white/50 line-through" : "text-white"
                    )}
                  >
                    {task.name}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">{task.description}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Rewards Section */}
      {!isLocked && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-xs text-white/40 uppercase tracking-wider mb-3">
            Stage Rewards
          </h4>
          <div className="p-3 rounded-lg bg-white/5">
            {isWanderer ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <span className="text-amber-400 text-sm">+{stage.wandererReward.sand}</span>
                </div>
                <div>
                  <div className="text-sm text-white">Crystallized Sand</div>
                  <div className="text-xs text-white/40">{stage.wandererReward.description}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-sm text-white">
                    {stage.sorcererReward.manaPool
                      ? `+${(stage.sorcererReward.manaPool / 1000).toFixed(0)}k Mana Pool`
                      : stage.sorcererReward.bonusMana
                        ? `+${(stage.sorcererReward.bonusMana / 1000).toFixed(0)}k Bonus Mana`
                        : "Rewards"}
                  </div>
                  <div className="text-xs text-white/40">{stage.sorcererReward.description}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
