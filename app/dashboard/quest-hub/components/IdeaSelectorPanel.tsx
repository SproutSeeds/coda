"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Lightbulb, Plus, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { IdeaSummary } from "../../path/components/IdeaSelector";
import type { JourneyState } from "@/lib/journey/types";
import { saveSelectedIdea } from "../actions";

interface IdeaSelectorPanelProps {
  ideas: IdeaSummary[];
  selectedIdeaId: string | null;
  journeyState: JourneyState;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function IdeaSelectorPanel({
  ideas,
  selectedIdeaId,
  journeyState,
}: IdeaSelectorPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Filter ideas by search query
  const filteredIdeas = ideas.filter((idea) =>
    idea.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectIdea = (ideaId: string) => {
    startTransition(async () => {
      await saveSelectedIdea(ideaId);
      router.push(`/dashboard/quest-hub?idea=${ideaId}`);
      router.refresh();
    });
  };

  // Show message if user is still on Stage 1 (global)
  if (journeyState.currentStage === 1) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center">
            <Lightbulb className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Complete Stage 1 First
          </h3>
          <p className="text-white/50 text-sm">
            Stage 1 is your introduction. Once you complete it, you&apos;ll be able to track
            progress for each of your ideas separately.
          </p>
        </div>
      </div>
    );
  }

  // Show message if no ideas
  if (ideas.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <Lightbulb className="w-8 h-8 text-white/30" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Ideas Yet</h3>
          <p className="text-white/50 text-sm mb-4">
            Create your first idea to start tracking quest progress.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Idea
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Search ideas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/20"
        />
      </div>

      {/* Info tip */}
      <p className="text-xs text-white/40 mb-4">
        Each idea tracks its own quest progress (Stages 2+). Select an idea to view its journey.
      </p>

      {/* Ideas list */}
      <div className="space-y-2">
        {filteredIdeas.map((idea, index) => {
          const isSelected = idea.id === selectedIdeaId;
          const progressPercent =
            idea.featureCount > 0
              ? Math.round((idea.completedCount / idea.featureCount) * 100)
              : 0;

          return (
            <motion.button
              key={idea.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => handleSelectIdea(idea.id)}
              disabled={isPending}
              className={cn(
                "w-full text-left p-3 rounded-lg transition-all duration-200",
                isSelected
                  ? "bg-cyan-500/20 border border-cyan-500/30"
                  : "bg-white/5 border border-transparent hover:bg-white/10"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Selection indicator */}
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    isSelected
                      ? "bg-cyan-500 text-black"
                      : "border border-white/20"
                  )}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </div>

                {/* Idea info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-medium truncate",
                        isSelected ? "text-cyan-400" : "text-white"
                      )}
                    >
                      {idea.title}
                    </span>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(idea.updatedAt)}
                    </span>
                    <span>
                      {idea.completedCount}/{idea.featureCount} features
                    </span>
                  </div>

                  {/* Progress bar */}
                  {idea.featureCount > 0 && (
                    <div className="mt-2">
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className={cn(
                            "h-full rounded-full",
                            isSelected ? "bg-cyan-500" : "bg-white/30"
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.5, delay: index * 0.03 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* No results */}
      {filteredIdeas.length === 0 && searchQuery && (
        <div className="text-center py-8 text-white/40 text-sm">
          No ideas match &quot;{searchQuery}&quot;
        </div>
      )}

      {/* Create new idea */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <a
          href="/dashboard"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-white/20 text-white/50 hover:border-white/40 hover:text-white/70 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Create New Idea
        </a>
      </div>
    </div>
  );
}
