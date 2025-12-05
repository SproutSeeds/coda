"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IdeaSummary {
  id: string;
  title: string;
  updatedAt: Date;
  featureCount: number;
  completedCount: number;
}

interface IdeaSelectorProps {
  ideas: IdeaSummary[];
  selectedIdeaId: string | null;
  onSelectIdea: (ideaId: string) => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function IdeaSelector({ ideas, selectedIdeaId, onSelectIdea }: IdeaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIdea = ideas.find((i) => i.id === selectedIdeaId);

  // Filter ideas by search query
  const filteredIdeas = ideas.filter((idea) =>
    idea.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full max-w-md mx-auto">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer",
          "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10",
          isOpen && "border-purple-500/50 bg-purple-500/10"
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
          <Sparkles className="h-5 w-5 text-purple-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider">
            Questing on
          </div>
          {selectedIdea ? (
            <div className="truncate text-white font-medium">{selectedIdea.title}</div>
          ) : (
            <div className="text-white/50 italic">Select an idea...</div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-white/40 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full rounded-xl border border-white/20 bg-black backdrop-blur-none shadow-2xl"
          >
            {/* Search Input */}
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search ideas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                />
              </div>
            </div>

            {/* Ideas List */}
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredIdeas.length === 0 ? (
                <div className="p-4 text-center text-white/40 text-sm">
                  {ideas.length === 0 ? "No ideas yet. Create one to start questing!" : "No matching ideas found"}
                </div>
              ) : (
                filteredIdeas.map((idea) => {
                  const isSelected = idea.id === selectedIdeaId;
                  return (
                    <button
                      key={idea.id}
                      onClick={() => {
                        onSelectIdea(idea.id);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 rounded-lg p-3 text-left transition-all cursor-pointer",
                        isSelected
                          ? "bg-purple-500/20 border border-purple-500/30"
                          : "hover:bg-white/5"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-medium truncate", isSelected ? "text-purple-300" : "text-white")}>
                          {idea.title}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(idea.updatedAt)}
                          </span>
                          <span>
                            {idea.completedCount}/{idea.featureCount} features
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="shrink-0 rounded-full bg-purple-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                          Active
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Quick Tip */}
            <div className="p-3 border-t border-white/10 bg-white/5">
              <p className="text-xs text-white/40 text-center">
                Each idea tracks its own quest progress. Switch ideas to see different stages!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
