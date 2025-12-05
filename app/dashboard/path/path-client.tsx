"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { JourneyState } from "@/lib/journey/types";
import type { StageDefinition } from "@/lib/journey/constants";
import type { IdeaQuestState } from "@/lib/journey/idea-progress";
import { QuestStageCard } from "./components/QuestStageCard";
import { QuestBackground } from "./components/QuestBackground";
import { Hourglass } from "./components/Hourglass";
import { IdeaSelector, type IdeaSummary } from "./components/IdeaSelector";
import { saveSelectedIdea, saveExpandedStages } from "./actions";

interface PathClientProps {
  journeyState: JourneyState;
  stages: StageDefinition[];
  totalStages: number;
  wandererPathStages: number;
  ideas: IdeaSummary[];
  selectedIdeaId: string | null;
  ideaProgress: IdeaQuestState | null;
  initialExpandedStages: string[];
}

export function PathClient({
  journeyState,
  stages,
  wandererPathStages,
  ideas,
  selectedIdeaId,
  ideaProgress,
  initialExpandedStages,
}: PathClientProps) {
  const router = useRouter();
  const isWanderer = journeyState.chosenPath === "wanderer";
  const isSorcerer = journeyState.chosenPath === "sorcerer";

  // Track expanded stages - initialize with saved state, or auto-expand current stage
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => {
    const initial = new Set(initialExpandedStages);
    // If no stages saved in cookie, auto-expand the current stage
    if (initial.size === 0 && journeyState.currentStage >= 1) {
      initial.add(`stage_${journeyState.currentStage}`);
    }
    return initial;
  });

  // Split stages into wanderer path and sorcerer ascension
  const wandererStages = stages.filter((s) => s.number <= wandererPathStages);
  const sorcererStages = stages.filter((s) => s.number > wandererPathStages);

  // Handle idea selection - save to cookie and refresh
  const handleSelectIdea = (ideaId: string) => {
    void saveSelectedIdea(ideaId);
    router.push(`/dashboard/path?idea=${ideaId}`);
  };

  // Handle stage expansion toggle
  const handleToggleExpanded = useCallback((stageId: string, isExpanded: boolean) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (isExpanded) {
        next.add(stageId);
      } else {
        next.delete(stageId);
      }
      return next;
    });
  }, []);

  // Persist expanded stages to cookie when they change (after initial render)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    void saveExpandedStages(Array.from(expandedStages));
  }, [expandedStages]);

  // Auto-expand newly unlocked current stage when user progresses
  const prevCurrentStage = useRef(journeyState.currentStage);
  useEffect(() => {
    if (journeyState.currentStage > prevCurrentStage.current) {
      // User advanced to a new stage - auto-expand it
      const newStageId = `stage_${journeyState.currentStage}`;
      setExpandedStages((prev) => {
        const next = new Set(prev);
        next.add(newStageId);
        return next;
      });
    }
    prevCurrentStage.current = journeyState.currentStage;
  }, [journeyState.currentStage]);

  // Find the selected idea name for display
  const selectedIdea = ideas.find((i) => i.id === selectedIdeaId);

  return (
    <div className="min-h-screen text-white relative selection:bg-purple-500/30">
      <QuestBackground />

      {/* Fixed Hourglass Widget - Positioned below header */}
      <div className="fixed top-24 right-4 z-50">
        <Hourglass
          sandEarned={journeyState.crystallizedSand}
          maxSand={30}
          manaPoolUnlocked={journeyState.manaPoolUnlocked}
          maxManaPool={200000}
          isWanderer={isWanderer}
          trialStartedAt={journeyState.trialStartedAt}
          trialEndsAt={journeyState.trialEndsAt}
        />
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="mb-4 font-mono text-sm tracking-widest text-purple-300/60">
            &gt; THE_QUEST_HUB<span className="animate-pulse">_</span>
          </div>
          <h1 className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
            Your Journey Unfolds
          </h1>
          <p className="mt-4 text-lg text-white/40">
            {isWanderer
              ? "Walk the path. Earn your time. The source is waiting."
              : "Ascend the steps. Unlock the flow. Master the infinite."}
          </p>
        </motion.div>

        {/* Idea Selector - Only show after Stage 1 */}
        {journeyState.currentStage > 1 && ideas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <IdeaSelector
              ideas={ideas}
              selectedIdeaId={selectedIdeaId}
              onSelectIdea={handleSelectIdea}
            />
            {selectedIdea && (
              <p className="text-center text-sm text-white/40 mt-3">
                Stages 2+ show progress for &quot;{selectedIdea.title}&quot;
              </p>
            )}
          </motion.div>
        )}

        {/* Part I: The Wanderer's Path */}
        <section className="mb-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 flex items-baseline gap-4 border-b border-white/10 pb-4"
          >
            <h2 className="text-2xl font-light text-white">
              Part I
            </h2>
            <span className="font-mono text-sm tracking-wider text-purple-300/60">
              THE_WANDERER&apos;S_PATH
            </span>
          </motion.div>

          <div className="space-y-6">
            {wandererStages.map((stage, index) => (
              <QuestStageCard
                key={stage.id}
                index={index}
                stage={stage}
                journeyState={journeyState}
                ideaProgress={stage.number >= 2 ? ideaProgress : null}
                isWanderer={isWanderer}
                isAccessible={stage.number <= journeyState.currentStage}
                isComplete={
                  stage.number === 1
                    ? !!journeyState.stagesCompleted[stage.id]
                    : !!ideaProgress?.stagesCompleted[stage.id]
                }
                isExpanded={expandedStages.has(stage.id)}
                onToggleExpanded={handleToggleExpanded}
              />
            ))}
          </div>
        </section>

        {/* Part II: The Sorcerer's Ascension */}
        <section>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8 flex items-baseline justify-between border-b border-white/10 pb-4"
          >
            <div className="flex items-baseline gap-4">
              <h2 className="text-2xl font-light text-white">
                Part II
              </h2>
              <span className="font-mono text-sm tracking-wider text-amber-300/60">
                THE_SORCERER&apos;S_ASCENSION
              </span>
            </div>
            {isWanderer && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                LOCKED
              </span>
            )}
          </motion.div>

          <div className="space-y-6">
            {sorcererStages.map((stage, index) => (
              <div key={stage.id} className={cn(isWanderer && "opacity-50 grayscale pointer-events-none")}>
                <QuestStageCard
                  index={index + 5} // Offset index for staggered animation
                  stage={stage}
                  journeyState={journeyState}
                  ideaProgress={ideaProgress}
                  isWanderer={isWanderer}
                  isAccessible={isSorcerer && stage.number <= journeyState.currentStage}
                  isComplete={!!ideaProgress?.stagesCompleted[stage.id]}
                  isLocked={isWanderer}
                  isExpanded={expandedStages.has(stage.id)}
                  onToggleExpanded={handleToggleExpanded}
                />
              </div>
            ))}
          </div>

          {/* Upgrade CTA */}
          {isWanderer && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-12 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-900/20 to-black p-8 text-center"
            >
              <h3 className="mb-2 text-2xl font-bold text-white">Unlock the Ascension</h3>
              <p className="mb-6 text-white/60">
                Upgrade to Sorcerer to access Stages 6-10, master AI & DevMode, and channel the infinite mana pool.
              </p>
              <a
                href="/choose-path"
                className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-6 py-3 text-sm font-bold text-black transition-transform hover:scale-105 hover:bg-amber-400"
              >
                Begin Ascension
              </a>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}