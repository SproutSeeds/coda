"use client";

import { motion } from "framer-motion";
import { Sparkles, Clock, Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyState } from "@/lib/journey/types";
import { WANDERER_REWARDS, SORCERER_REWARDS } from "@/lib/journey/constants";

interface ProgressStatsPanelProps {
  journeyState: JourneyState;
  completionPercent: number;
  totalStages: number;
  wandererPathStages: number;
}

export function ProgressStatsPanel({
  journeyState,
  completionPercent,
  totalStages,
  wandererPathStages,
}: ProgressStatsPanelProps) {
  const isWanderer = journeyState.chosenPath === "wanderer";

  // Calculate stages completed
  const stagesCompleted = Object.keys(journeyState.stagesCompleted).length;
  const accessibleStages = isWanderer ? wandererPathStages : totalStages;

  // Format mana with k suffix
  const formatMana = (mana: number) => {
    if (mana >= 1000) {
      return `${(mana / 1000).toFixed(mana % 1000 === 0 ? 0 : 1)}k`;
    }
    return mana.toString();
  };

  // Calculate trial days for wanderers
  const trialDaysRemaining = journeyState.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(journeyState.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : journeyState.trialDaysEarned;

  return (
    <div className="p-6">
      {/* Path Badge */}
      <div className="flex justify-center mb-6">
        <div
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium",
            isWanderer
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
          )}
        >
          {isWanderer ? "Wanderer" : "Sorcerer"}
        </div>
      </div>

      {/* Main Progress Circle */}
      <div className="flex justify-center mb-8">
        <div className="relative w-32 h-32">
          {/* Background ring */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="6"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={isWanderer ? "#4ade80" : "#a855f7"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{
                strokeDashoffset: 2 * Math.PI * 42 * (1 - completionPercent / 100),
              }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{completionPercent}%</span>
            <span className="text-xs text-white/40">Complete</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Stages Completed */}
        <div className="p-3 rounded-lg bg-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-white/40">Stages</span>
          </div>
          <div className="text-xl font-bold text-white">
            {stagesCompleted}/{accessibleStages}
          </div>
        </div>

        {/* Current Stage */}
        <div className="p-3 rounded-lg bg-white/5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-white/40">Current</span>
          </div>
          <div className="text-xl font-bold text-white">
            Stage {journeyState.currentStage}
          </div>
        </div>
      </div>

      {/* Path-Specific Stats */}
      {isWanderer ? (
        <>
          {/* Wanderer: Sand & Trial Days */}
          <div className="space-y-3">
            {/* Crystallized Sand */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Crystallized Sand</div>
                    <div className="text-xs text-white/40">Time earned</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-amber-400">
                    {journeyState.crystallizedSand}
                  </div>
                  <div className="text-xs text-white/40">
                    of {WANDERER_REWARDS.totalSand} scoops
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(journeyState.crystallizedSand / WANDERER_REWARDS.totalSand) * 100}%`,
                  }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Trial Days */}
            <div className="p-4 rounded-lg bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Trial Days</div>
                  <div className="text-xs text-white/40">
                    {journeyState.trialEndsAt ? "Remaining" : "Earned"}
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {trialDaysRemaining} days
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-400 shrink-0" />
              <div>
                <div className="text-sm font-medium text-white">
                  Unlock Unlimited Power
                </div>
                <div className="text-xs text-white/50">
                  Upgrade to Sorcerer for full mana pool access
                </div>
              </div>
            </div>
            <a
              href="/dashboard/billing"
              className="mt-3 block w-full py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm text-center hover:bg-purple-500/30 transition-colors"
            >
              Upgrade Now
            </a>
          </div>
        </>
      ) : (
        <>
          {/* Sorcerer: Mana Stats */}
          <div className="space-y-3">
            {/* Mana Pool */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Mana Pool</div>
                    <div className="text-xs text-white/40">Unlocked capacity</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-400">
                    {formatMana(journeyState.manaPoolUnlocked)}
                  </div>
                  <div className="text-xs text-white/40">
                    of {formatMana(SORCERER_REWARDS.totalManaPool)}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(journeyState.manaPoolUnlocked / SORCERER_REWARDS.totalManaPool) * 100}%`,
                  }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Bonus Mana */}
            <div className="p-4 rounded-lg bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Bonus Mana</div>
                  <div className="text-xs text-white/40">From Ascension stages</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-amber-400">
                    +{formatMana(journeyState.bonusManaEarned)}
                  </div>
                  <div className="text-xs text-white/40">
                    of {formatMana(SORCERER_REWARDS.totalBonusMana)}
                  </div>
                </div>
              </div>
            </div>

            {/* Total Mana */}
            <div className="p-4 rounded-lg bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Total Earned</div>
                  <div className="text-xs text-white/40">Mana from tasks</div>
                </div>
                <div className="text-xl font-bold text-cyan-400">
                  {formatMana(journeyState.totalMana)}
                </div>
              </div>
            </div>
          </div>

          {/* Features Unlocked */}
          {journeyState.featuresUnlocked.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                Features Unlocked
              </h4>
              <div className="flex flex-wrap gap-2">
                {journeyState.featuresUnlocked.map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 capitalize"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
