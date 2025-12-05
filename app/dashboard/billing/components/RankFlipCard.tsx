"use client";

import { motion } from "framer-motion";
import { Crown, ArrowRight, Compass } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SubscriptionToggle } from "../subscription-toggle";
import {
  manageSubscriptionAction,
  renewSubscriptionAction,
  cancelSubscriptionAction,
} from "../actions";

// ============================================================================
// Types
// ============================================================================

interface RankFlipCardProps {
  isSorcerer: boolean;
  subscription: {
    planLabel: string | null;
    renewalDate: Date | null;
    scheduledCancellation: Date | null;
    scheduledAnnualStart: Date | null;
  };
}

function ActiveSorcererFace({ subscription }: { subscription: RankFlipCardProps["subscription"] }) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-amber-100">Sorcerer</h2>
            <p className="text-xs text-amber-200/40">Active subscription</p>
          </div>
        </div>
        <div className={cn(
          "px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border",
          subscription.scheduledCancellation
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : "border-amber-500/30 bg-amber-500/10 text-amber-400"
        )}>
          {subscription.scheduledCancellation ? "Ending" : "Active"}
        </div>
      </div>

      {/* Minimal divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent mb-6" />

      {/* Plan details */}
      <div className="space-y-4 mb-6">
        <div className="rounded-lg bg-black/30 border border-amber-500/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Current Pact</p>
              <p className="text-lg font-light text-white">{subscription.planLabel}</p>
            </div>
            {subscription.renewalDate && (
              <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Renews</p>
                <p className="text-sm text-white/70">{subscription.renewalDate.toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        {subscription.scheduledCancellation && (
          <p className="text-xs text-amber-400/80">
            Access ends {subscription.scheduledCancellation.toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          {subscription.scheduledCancellation ? (
            !subscription.scheduledAnnualStart && (
              <SubscriptionToggle
                action={renewSubscriptionAction}
                label="Renew"
                variant="renew"
              />
            )
          ) : (
            <SubscriptionToggle
              action={cancelSubscriptionAction}
              label="Cancel"
              variant="cancel"
            />
          )}
        </div>
        <form action={manageSubscriptionAction}>
          <button className="text-xs font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
            Manage <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RankFlipCard({ isSorcerer, subscription }: RankFlipCardProps) {
  // If user is already a sorcerer, show the active sorcerer card
  if (isSorcerer) {
    return (
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-xl p-6",
            "border border-amber-500/20",
            "bg-gradient-to-b from-amber-950/40 to-black/60",
            "backdrop-blur-sm"
          )}
        >
          <ActiveSorcererFace subscription={subscription} />
        </motion.div>
      </div>
    );
  }

  // Non-subscriber view - link to choose-path page
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative rounded-xl p-6",
          "bg-gradient-to-b from-slate-800/90 to-slate-900/95",
          "backdrop-blur-sm",
          "border-2 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.1)]"
        )}
      >
        {/* Corner ornaments */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg border-purple-500/40" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg border-purple-500/40" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg border-purple-500/40" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg border-purple-500/40" />

        {/* Inner glow effect */}
        <div className="absolute inset-0 rounded-xl pointer-events-none bg-gradient-to-b from-purple-500/5 to-transparent" />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Compass className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Choose Your Path</h2>
              <p className="text-xs text-white/40">Begin your journey</p>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border border-purple-500/30 bg-purple-500/10 text-purple-400">
            Wanderer
          </div>
        </div>

        {/* Minimal divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />

        {/* Description */}
        <p className="relative z-10 text-sm text-white/50 mb-6 leading-relaxed">
          Explore the paths available to you. Walk as a Wanderer earning your way through quests,
          or embrace the power of a Sorcerer with unlimited access.
        </p>

        {/* CTA Button */}
        <Link
          href="/choose-path"
          className="relative z-10 flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 py-3 text-sm font-semibold text-white transition-all hover:from-purple-500 hover:to-purple-600 hover:shadow-lg hover:shadow-purple-500/20"
        >
          <Compass className="w-4 h-4" />
          Explore Paths
          <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}
