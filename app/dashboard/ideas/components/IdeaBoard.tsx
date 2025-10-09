"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

import { IdeaList } from "./IdeaList";
import { DeletedIdeaList } from "./DeletedIdeaList";
import type { Idea } from "./types";
import { cn } from "@/lib/utils";

const sortOptions = [
  { value: "priority", label: "Manual priority" },
  { value: "created_desc", label: "Newest created" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "title_asc", label: "Title A→Z" },
] as const;

export function IdeaBoard({
  ideas,
  deleted,
  query,
  sort,
}: {
  ideas: Idea[];
  deleted: Idea[];
  query?: string;
  sort: string;
}) {
  const [view, setView] = useState<"active" | "deleted">("active");
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSort = useMemo(() => {
    const allowed = sortOptions.map((option) => option.value);
    return allowed.includes(sort as typeof sortOptions[number]["value"]) ? sort : "priority";
  }, [sort]);

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

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");
    if (value === "priority") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    router.push(`/dashboard/ideas?${params.toString()}`);
  };

  const canReorder = currentSort === "priority" && !(query && query.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={view === "active" ? "default" : "outline"}
            size="sm"
            className={cn(
              "interactive-btn transition-transform duration-150",
              view === "active" ? "bg-primary hover:bg-primary" : "hover:bg-transparent focus-visible:ring-0",
            )}
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
        <div className="flex items-center gap-2">
          <label htmlFor="idea-sort" className="text-xs font-medium text-muted-foreground">
            Sort by
          </label>
          <select
            id="idea-sort"
            value={currentSort}
            onChange={(event) => handleSortChange(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="ideas-sort-select"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === "active" ? (
        <IdeaList ideas={ideas} query={query} canReorder={canReorder} />
      ) : (
        <DeletedIdeaList ideas={deleted} />
      )}
    </div>
  );
}
