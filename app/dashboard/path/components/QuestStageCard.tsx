"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check, Lock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageDefinition } from "@/lib/journey/constants";
import type { JourneyState } from "@/lib/journey/types";
import type { IdeaQuestState } from "@/lib/journey/idea-progress";
import type { StageKey, TaskKey, IdeaStageKey } from "@/lib/db/schema/journey";
import { useTutorial } from "@/components/tutorial/TutorialProvider";

// --- Icons ---

function WandererIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 22C12 22 9 18 9 12C9 6 12 2 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5"/>
      <path d="M12 22C12 22 15 18 15 12C15 6 12 2 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5"/>
    </svg>
  );
}

function SorcererIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2L15 8L21 9L16.5 14L18 20L12 17L6 20L7.5 14L3 9L9 8L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" className="opacity-50" />
    </svg>
  );
}

// --- 3D Card Component ---

interface QuestStageCardProps {
  stage: StageDefinition;
  journeyState: JourneyState;
  ideaProgress: IdeaQuestState | null;
  isWanderer: boolean;
  isAccessible: boolean;
  isComplete: boolean;
  isLocked?: boolean;
  index: number;
  isExpanded?: boolean;
  onToggleExpanded?: (stageId: string, isExpanded: boolean) => void;
}

export function QuestStageCard({
  stage,
  journeyState,
  ideaProgress,
  isWanderer,
  isAccessible,
  isComplete,
  isLocked = false,
  index,
  isExpanded: controlledIsExpanded,
  onToggleExpanded,
}: QuestStageCardProps) {
  const { showTutorial } = useTutorial();

  // Determine default expansion: current stage is expanded by default (if accessible and not complete)
  const defaultExpanded = isAccessible && !isComplete && stage.number === journeyState.currentStage;

  // Use controlled state if provided, otherwise use local state
  const [localIsExpanded, setLocalIsExpanded] = useState(defaultExpanded);

  // If controlledIsExpanded is undefined, use local state; otherwise use controlled
  // Also auto-expand current stage if it's not in the cookie yet
  const isExpanded = controlledIsExpanded !== undefined
    ? controlledIsExpanded
    : (localIsExpanded || defaultExpanded);

  const handleToggle = () => {
    const newValue = !isExpanded;
    if (onToggleExpanded) {
      onToggleExpanded(stage.id, newValue);
    } else {
      setLocalIsExpanded(newValue);
    }
  };

  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

  const holoBackground = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [
      "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.0) 50%)",
      "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.0) 70%)"
    ]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // For stage 1, use global journey state. For stages 2+, use per-idea progress if available
  const isPerIdeaStage = stage.number >= 2;
  const stageKey = stage.id as StageKey;
  const ideaStageKey = stage.id as IdeaStageKey;

  const stageTasks = isPerIdeaStage && ideaProgress
    ? ideaProgress.tasksCompleted[ideaStageKey]
    : journeyState.tasksCompleted[stageKey];

  const completedTaskCount = stageTasks
    ? Object.values(stageTasks).filter(Boolean).length
    : 0;

  const isCurrent = stage.number === journeyState.currentStage && !isComplete;
  const borderColor = isWanderer ? "border-purple-500/30" : "border-amber-500/30";
  const glowColor = isWanderer ? "shadow-[0_0_30px_-10px_rgba(168,85,247,0.3)]" : "shadow-[0_0_30px_-10px_rgba(245,158,11,0.3)]";

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="perspective-1000 py-2"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border backdrop-blur-md transition-all duration-300",
          isComplete
            ? "border-green-500/20 bg-green-900/10"
            : isCurrent
            ? cn(borderColor, isWanderer ? "bg-purple-900/10" : "bg-amber-900/10", glowColor)
            : isLocked
            ? "border-white/5 bg-white/5 opacity-60"
            : "border-white/10 bg-white/5 hover:border-white/20"
        )}
      >
        {/* Holo Effect */}
        {!isLocked && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: holoBackground, backgroundSize: "200% 200%" }}
          />
        )}

        {/* Content */}
        <div className="relative z-20">
          <button
            onClick={() => !isLocked && handleToggle()}
            disabled={isLocked}
            className={cn(
              "flex w-full items-center gap-4 p-5 text-left transition-colors",
              !isLocked && "cursor-pointer hover:bg-white/5"
            )}
          >
            {/* Status Icon */}
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-lg font-bold",
                isComplete
                  ? "border-green-500/50 bg-green-500/20 text-green-400"
                  : isCurrent
                  ? cn(borderColor, isWanderer ? "bg-purple-500/20 text-purple-300" : "bg-amber-500/20 text-amber-300")
                  : "border-white/10 bg-white/5 text-white/30"
              )}
            >
              {isComplete ? <Check className="h-6 w-6" /> : isLocked ? <Lock className="h-5 w-5" /> : stage.number}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h3 className={cn("text-lg font-bold", isComplete ? "text-white/60" : "text-white")}>
                  {stage.name}
                </h3>
                {isCurrent && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    isWanderer ? "bg-purple-500/20 text-purple-300" : "bg-amber-500/20 text-amber-300"
                  )}>
                    Current
                  </span>
                )}
              </div>
              <p className="text-sm text-white/40">{stage.theme}</p>
            </div>

            {/* Progress or Arrow */}
            <div className="flex items-center gap-4">
              {!isLocked && (
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-white/80">
                    {completedTaskCount} / {stage.tasks.length}
                  </div>
                  <div className="text-xs text-white/30">tasks</div>
                </div>
              )}
              {!isLocked && (
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-white/40 transition-transform duration-300",
                    isExpanded && "rotate-180"
                  )}
                />
              )}
            </div>
          </button>

          <AnimatePresence>
            {isExpanded && !isLocked && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-white/5 px-5 pb-5 pt-2">
                  <p className="mb-6 text-sm leading-relaxed text-white/60">
                    {stage.description}
                  </p>

                  <div className="space-y-2">
                    {stage.tasks.map((task) => {
                      const taskKey = task.id as TaskKey;
                      const isTaskComplete = stageTasks?.[taskKey] ?? false;

                      return (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Trigger tutorial if available for this action
                            // We use the task's actionType which maps to tutorial steps
                            showTutorial(task.actionType);
                          }}
                          className={cn(
                            "flex items-start gap-3 rounded-lg p-3 transition-all duration-200",
                            "cursor-pointer hover:scale-[1.02]", // Add interactivity cues
                            isTaskComplete 
                              ? "bg-green-500/10 hover:bg-green-500/20" 
                              : "bg-white/5 hover:bg-white/10 hover:shadow-[0_0_15px_-5px_rgba(255,255,255,0.3)]"
                          )}
                        >
                          <div
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                              isTaskComplete
                                ? "border-green-500 bg-green-500 text-black"
                                : "border-white/20 group-hover:border-white/40"
                            )}
                          >
                            {isTaskComplete && <Check className="h-3 w-3" />}
                          </div>
                          <div className="flex-1">
                            <div className={cn("text-sm font-medium", isTaskComplete ? "text-green-400 line-through opacity-70" : "text-white")}>
                              {task.name}
                            </div>
                            <div className="text-xs text-white/40">{task.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reward Section */}
                  <div className={cn(
                    "mt-6 flex items-center gap-3 rounded-lg border p-3",
                    isWanderer ? "border-purple-500/20 bg-purple-500/10" : "border-amber-500/20 bg-amber-500/10"
                  )}>
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      isWanderer ? "bg-purple-500/20" : "bg-amber-500/20"
                    )}>
                      {isWanderer ? <WandererIcon className="h-6 w-6 text-purple-300" /> : <SorcererIcon className="h-6 w-6 text-amber-300" />}
                    </div>
                    <div>
                      <div className={cn(
                        "text-xs font-bold uppercase tracking-wider",
                        isWanderer ? "text-purple-300" : "text-amber-300"
                      )}>
                        Reward
                      </div>
                      <div className="text-sm text-white/80">
                        {isWanderer ? stage.wandererReward.description : stage.sorcererReward.description}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}