"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { IdeaList } from "./IdeaList";
import { DeletedIdeaList } from "./DeletedIdeaList";
import type { Idea } from "./types";
import { cn } from "@/lib/utils";

export function IdeaBoard({
  ideas,
  deleted,
  query,
}: {
  ideas: Idea[];
  deleted: Idea[];
  query?: string;
}) {
  const [view, setView] = useState<"active" | "deleted">("active");

  useEffect(() => {
    if (query && query.trim().length > 0) {
      setView("active");
    }
  }, [query]);

  useEffect(() => {
    if (deleted.length === 0 && view === "deleted") {
      setView("active");
    }
  }, [deleted.length, view]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={view === "active" ? "default" : "outline"}
          size="sm"
          className={cn("interactive-btn transition-transform duration-150", view === "active" ? "bg-primary hover:bg-primary" : "hover:bg-transparent focus-visible:ring-0")}
          onClick={() => setView("active")}
        >
          Active ideas ({ideas.length})
        </Button>
        {deleted.length > 0 ? (
          <Button
            type="button"
            variant={view === "deleted" ? "default" : "outline"}
            size="sm"
            className={cn(
              "interactive-btn transition-transform duration-150",
              view === "deleted" ? "bg-primary hover:bg-primary" : "hover:bg-transparent focus-visible:ring-0",
            )}
            onClick={() => setView("deleted")}
          >
            Recently deleted ({deleted.length})
          </Button>
        ) : null}
      </div>

      {view === "active" ? (
        <IdeaList ideas={ideas} query={query} />
      ) : (
        <DeletedIdeaList ideas={deleted} />
      )}
    </div>
  );
}
