"use client";

import { Idea } from "./types";
import { IdeaCard } from "./IdeaCard";
import { AnimatePresence } from "framer-motion";

export function IdeaList({ ideas, query }: { ideas: Idea[]; query?: string }) {
  if (ideas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {query ? "No ideas match your search." : "No ideas yet. Capture your first thought to get started."}
      </p>
    );
  }

  return (
    <AnimatePresence>
      <div className="space-y-4">
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </div>
    </AnimatePresence>
  );
}
