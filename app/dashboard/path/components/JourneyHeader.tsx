"use client";

import { motion } from "framer-motion";
import { Moon, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChosenPath } from "@/lib/journey/types";

interface JourneyHeaderProps {
  chosenPath: ChosenPath;
  currentStage: number;
  wandererPathCompleted: boolean;
  sorcererAscensionCompleted: boolean;
}

export function JourneyHeader({
  chosenPath,
  currentStage,
  wandererPathCompleted,
  sorcererAscensionCompleted,
}: JourneyHeaderProps) {
  const isWanderer = chosenPath === "wanderer";
  const isSorcerer = chosenPath === "sorcerer";

  function getTitle() {
    if (sorcererAscensionCompleted) return "Master of the Path";
    if (wandererPathCompleted && isSorcerer) return "The Sorcerer's Ascension";
    if (wandererPathCompleted && isWanderer) return "Journey Complete";
    return "The Wanderer's Path";
  }

  function getSubtitle() {
    if (sorcererAscensionCompleted) {
      return "You have mastered all paths. All powers are yours.";
    }
    if (wandererPathCompleted && isSorcerer) {
      return "Continue your ascension to unlock advanced powers.";
    }
    if (wandererPathCompleted && isWanderer) {
      return "You've earned your time. Create wisely, wanderer.";
    }
    return isWanderer
      ? "Earn crystallized sand through creation. Extend your journey."
      : "Unlock your mana pool through creation. Power awaits.";
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      {/* Path Badge */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
            isWanderer
              ? "bg-primary/10 text-primary"
              : "bg-amber-500/10 text-amber-500"
          )}
        >
          {isWanderer ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          <span>{isWanderer ? "Wanderer" : "Sorcerer"}</span>
        </div>

        <span className="text-sm text-muted-foreground">
          Stage {currentStage} of {isWanderer ? 5 : 10}
        </span>
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
        {getTitle()}
      </h1>

      {/* Subtitle */}
      <p className="text-muted-foreground max-w-2xl">
        {getSubtitle()}
      </p>

      {/* Inspirational Quote */}
      <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
        <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm italic text-muted-foreground">
          {isWanderer
            ? '"The infinite source is within. Mana manifests through the act of creation itself."'
            : '"Power is not given—it is unlocked through will and creation."'}
        </p>
      </div>
    </motion.header>
  );
}
