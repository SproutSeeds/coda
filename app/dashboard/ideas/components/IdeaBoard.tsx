"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

import { IdeaList } from "./IdeaList";
import { DeletedIdeaList } from "./DeletedIdeaList";
import type { Idea } from "./types";
import { SearchBar } from "./SearchBar";
import { cn } from "@/lib/utils";
import { Funnel } from "lucide-react";

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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [ideaFilter, setIdeaFilter] = useState<"all" | "starred" | "unstarred">("all");

  const currentSort = useMemo(() => {
    const allowed = sortOptions.map((option) => option.value);
    return allowed.includes(sort as typeof sortOptions[number]["value"]) ? sort : "priority";
  }, [sort]);

  useEffect(() => {
    if (!isFilterOpen) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!filterPanelRef.current) return;
      if (
        filterPanelRef.current.contains(target) ||
        (filterTriggerRef.current && filterTriggerRef.current.contains(target))
      ) {
        return;
      }
      setIsFilterOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isFilterOpen]);

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
  const totalIdeas = ideas.length;
  const starredIdeas = useMemo(() => ideas.filter((idea) => idea.starred).length, [ideas]);
  const unstarredIdeas = totalIdeas - starredIdeas;
  const filteredIdeas = useMemo(() => {
    switch (ideaFilter) {
      case "starred":
        return ideas.filter((idea) => idea.starred);
      case "unstarred":
        return ideas.filter((idea) => !idea.starred);
      default:
        return ideas;
    }
  }, [ideaFilter, ideas]);

  return (
    <div className="relative space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Ideas</h2>
          <p className="text-sm text-muted-foreground">High-signal captures and in-flight builds.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <SearchBar className="w-full sm:max-w-sm lg:max-w-md" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="interactive-btn border-border text-muted-foreground hover:bg-muted/30"
            onClick={() => setIsFilterOpen((previous) => !previous)}
            ref={filterTriggerRef}
            aria-expanded={isFilterOpen}
            aria-label="Filter ideas"
          >
            <Funnel className="size-4" />
          </Button>
        </div>
      </div>

      {isFilterOpen ? (
        <div
          ref={filterPanelRef}
          className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4 shadow-lg"
        >
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="View">
            <Button
              type="button"
              variant={view === "active" ? "default" : "outline"}
              size="sm"
              className={cn(
                "interactive-btn rounded-full px-4 py-1.5 text-xs font-semibold uppercase",
                view === "active" ? "bg-primary text-primary-foreground" : "hover:bg-muted/30",
              )}
              onClick={() => {
                setView("active");
                setIsFilterOpen(false);
              }}
            >
              Active ({ideas.length})
            </Button>
            <Button
              type="button"
              variant={view === "deleted" ? "default" : "outline"}
              size="sm"
              className={cn(
                "interactive-btn rounded-full px-4 py-1.5 text-xs font-semibold uppercase",
                view === "deleted" ? "bg-primary text-primary-foreground" : "hover:bg-muted/30",
              )}
              onClick={() => {
                setView("deleted");
                setIsFilterOpen(false);
              }}
              disabled={deleted.length === 0}
            >
              Recently deleted ({deleted.length})
            </Button>
          </div>
          {view === "active" ? (
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter ideas">
              {[
                { value: "all", label: "All", count: totalIdeas },
                { value: "starred", label: "Starred", count: starredIdeas },
                { value: "unstarred", label: "Unstarred", count: unstarredIdeas },
              ].map((option) => {
                const isActive = ideaFilter === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "interactive-btn rounded-full px-4 py-1.5 text-xs font-semibold uppercase",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted/30",
                    )}
                    onClick={() => {
                      setIdeaFilter(option.value as typeof ideaFilter);
                      setIsFilterOpen(false);
                    }}
                    disabled={option.value !== "all" && option.count === 0}
                  >
                    {option.count > 0 ? `${option.label} (${option.count})` : option.label}
                  </Button>
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <label htmlFor="idea-sort" className="text-xs font-medium text-muted-foreground">
              Sort by
            </label>
            <select
              id="idea-sort"
              value={currentSort}
              onChange={(event) => {
                handleSortChange(event.target.value);
                setIsFilterOpen(false);
              }}
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
      ) : null}

      {view === "active" ? (
        <IdeaList ideas={filteredIdeas} query={query} canReorder={canReorder} />
      ) : (
        <DeletedIdeaList ideas={deleted} />
      )}
    </div>
  );
}
