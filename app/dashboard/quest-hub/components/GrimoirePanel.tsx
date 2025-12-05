"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles, Wand2, Eye, FileText, Search as SearchIcon } from "lucide-react";
import type { JourneyState } from "@/lib/journey/types";

interface GrimoirePanelProps {
  journeyState: JourneyState;
}

// Preview spell categories (will be real data when Grimoire is implemented)
const SPELL_CATEGORIES = [
  {
    name: "Summoning",
    icon: Wand2,
    description: "Generate ideas and features",
    spellCount: 3,
    color: "purple",
  },
  {
    name: "Divination",
    icon: Eye,
    description: "Analyze and research",
    spellCount: 4,
    color: "cyan",
  },
  {
    name: "Inscription",
    icon: FileText,
    description: "Create documentation",
    spellCount: 2,
    color: "amber",
  },
  {
    name: "Scrying",
    icon: SearchIcon,
    description: "Search and discover",
    spellCount: 3,
    color: "green",
  },
];

export function GrimoirePanel({ journeyState }: GrimoirePanelProps) {
  const isWanderer = journeyState.chosenPath === "wanderer";

  // Format mana
  const formatMana = (mana: number) => {
    if (mana >= 1000) {
      return `${(mana / 1000).toFixed(mana % 1000 === 0 ? 0 : 1)}k`;
    }
    return mana.toString();
  };

  return (
    <div className="p-6">
      {/* Coming Soon Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-amber-500/20 flex items-center justify-center border border-purple-500/30"
        >
          <BookOpen className="w-10 h-10 text-purple-400" />
        </motion.div>
        <h2 className="text-xl font-bold text-white mb-2">The Grimoire</h2>
        <p className="text-white/50 text-sm">Your spellbook of AI operations</p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs border border-amber-500/30">
          <Sparkles className="w-3 h-3" />
          Coming Soon
        </div>
      </div>

      {/* Mana Balance */}
      <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-white">Available Mana</span>
          </div>
          <div className="text-xl font-bold text-purple-400">
            {formatMana(journeyState.manaPoolUnlocked + journeyState.bonusManaEarned)}
          </div>
        </div>
        {isWanderer && (
          <p className="text-xs text-white/40 mt-2">
            Upgrade to Sorcerer to unlock your full mana pool
          </p>
        )}
      </div>

      {/* Spell Categories Preview */}
      <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Spell Categories
      </h3>
      <div className="space-y-2">
        {SPELL_CATEGORIES.map((category, index) => {
          const Icon = category.icon;
          const colorClasses = {
            purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
            cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
            amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
            green: "bg-green-500/10 border-green-500/20 text-green-400",
          };
          const classes = colorClasses[category.color as keyof typeof colorClasses];

          return (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-3 rounded-lg border ${classes} opacity-60`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white text-sm">{category.name}</div>
                  <div className="text-xs text-white/40">{category.description}</div>
                </div>
                <div className="text-xs text-white/30">{category.spellCount} spells</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* What's Coming */}
      <div className="mt-6 p-4 rounded-lg bg-white/5">
        <h4 className="text-sm font-medium text-white mb-2">What&apos;s Coming</h4>
        <ul className="space-y-2 text-xs text-white/50">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Cast AI spells to generate features and ideas
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Track spell mastery and usage
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Create and share custom spells
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Browse community spell library
          </li>
        </ul>
      </div>
    </div>
  );
}
