"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface HourglassProps {
  sandEarned: number;
  maxSand: number;
  manaPoolUnlocked: number;
  maxManaPool: number;
  isWanderer: boolean;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
}

export function Hourglass({
  sandEarned,
  maxSand,
  manaPoolUnlocked,
  maxManaPool,
  isWanderer,
  trialStartedAt,
  trialEndsAt,
}: HourglassProps) {
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);
  const sandPercent = Math.min((sandEarned / maxSand) * 100, 100);
  const manaPercent = Math.min((manaPoolUnlocked / maxManaPool) * 100, 100);

  // Calculate days remaining for wanderer
  const daysRemaining = trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : sandEarned;

  // Format exact timestamp
  const formatExactTime = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const handleClick = () => {
    router.push("/dashboard/billing");
  };

  return (
    <div className="relative text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          "relative flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md cursor-pointer",
          "transition-all duration-200 hover:scale-105",
          isWanderer
            ? "border-purple-500/30 bg-purple-900/20"
            : "border-amber-500/30 bg-amber-900/20"
        )}
      >
        {/* Icon */}
        <div className="relative">
          {isWanderer ? (
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                "bg-purple-500/20"
              )}
            >
              <Clock className="w-5 h-5 text-purple-300" />
            </div>
          ) : (
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                "bg-amber-500/20"
              )}
            >
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isWanderer ? (
              <>
                <span className="font-semibold text-sm text-white">
                  {daysRemaining} days
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-sm text-white">
                  {(manaPoolUnlocked / 1000).toFixed(0)}k
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </>
            )}
          </div>
          <p className="text-xs text-white/50">
            {isWanderer
              ? `${sandEarned}/${maxSand} scoops`
              : `${(manaPoolUnlocked / 1000).toFixed(0)}/${maxManaPool / 1000}k unlocked`}
          </p>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl overflow-hidden bg-black/40">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${isWanderer ? sandPercent : manaPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
              "h-full",
              isWanderer ? "bg-purple-500" : "bg-amber-500"
            )}
          />
        </div>
      </motion.div>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-full mt-2 right-0 z-50 w-72 p-4 rounded-xl border border-white/10 bg-black/95 shadow-xl backdrop-blur-xl"
          >
            {isWanderer ? (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-sm text-purple-300">Crystallized Sand</p>
                  <p className="text-xs text-white/60 mt-1">
                    {sandEarned}/{maxSand} scoops earned = {sandEarned} days
                  </p>
                </div>
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40">Started</span>
                    <span className="text-xs font-mono text-purple-200">{formatExactTime(trialStartedAt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40">Expires</span>
                    <span className="text-xs font-mono text-purple-200">{formatExactTime(trialEndsAt)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/40 pt-1">
                  Click to view details in Arcane Ledger
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-sm text-amber-300">Mana Pool</p>
                <p className="text-xs text-white/60">
                  You&apos;ve unlocked {(manaPoolUnlocked / 1000).toFixed(0)}k of your
                  200k mana pool. Complete stages to unlock more!
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
