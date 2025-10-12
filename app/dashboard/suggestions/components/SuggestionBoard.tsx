"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

import { SuggestionList } from "./SuggestionList";
import { DeletedSuggestionList } from "./DeletedSuggestionList";
import { SuggestionCard } from "./SuggestionCard";
import type { Suggestion } from "./types";
import { SearchBar } from "../../ideas/components/SearchBar";
import { cn } from "@/lib/utils";
import { Funnel } from "lucide-react";

const sortOptions = [
  { value: "priority", label: "Manual priority" },
  { value: "created_desc", label: "Newest created" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "title_asc", label: "Title A→Z" },
] as const;

export function SuggestionBoard({
  suggestions,
  deleted,
  query,
  sort,
}: {
  suggestions: Suggestion[];
  deleted: Suggestion[];
  query?: string;
  sort: string;
}) {
  const [view, setView] = useState<"active" | "completed" | "deleted">("active");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [filter, setFilter] = useState<"all" | "starred" | "unstarred">("all");

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
    router.push(`/dashboard/suggestions?${params.toString()}`);
  };

  const canReorder = currentSort === "priority" && !(query && query.trim().length > 0);
  const starredCount = useMemo(() => suggestions.filter((item) => item.starred && !item.completed).length, [suggestions]);
  const unstarredCount = useMemo(
    () => suggestions.filter((item) => !item.starred && !item.completed).length,
    [suggestions],
  );

  const activeSuggestions = useMemo(() => suggestions.filter((item) => !item.completed), [suggestions]);
  const completedSuggestions = useMemo(() => suggestions.filter((item) => item.completed), [suggestions]);

  const filteredActiveSuggestions = useMemo(() => {
    switch (filter) {
      case "starred":
        return activeSuggestions.filter((item) => item.starred);
      case "unstarred":
        return activeSuggestions.filter((item) => !item.starred);
      default:
        return activeSuggestions;
    }
  }, [filter, activeSuggestions]);

  return (
    <div className="relative space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Suggestion box</h2>
          <p className="text-sm text-muted-foreground">Centralize product feedback and prioritize what matters most.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <SearchBar className="w-full sm:max-w-sm lg:max-w-md" placeholder="Search suggestions" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="interactive-btn border-border text-muted-foreground hover:bg-muted/30"
            onClick={() => setIsFilterOpen((previous) => !previous)}
            ref={filterTriggerRef}
            aria-expanded={isFilterOpen}
            aria-label="Filter suggestions"
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
            {[
              { key: "active" as const, label: `Active (${activeSuggestions.length})` },
              { key: "completed" as const, label: `Completed (${completedSuggestions.length})` },
              { key: "deleted" as const, label: `Archived (${deleted.length})`, disabled: deleted.length === 0 },
            ].map((option) => (
              <Button
                key={option.key}
                type="button"
                variant={view === option.key ? "default" : "outline"}
                size="sm"
                className={cn(
                  "interactive-btn rounded-full px-4 py-1.5 text-xs font-semibold uppercase",
                  view === option.key ? "bg-primary text-primary-foreground" : "hover:bg-muted/30",
                )}
                onClick={() => {
                  setView(option.key);
                  setIsFilterOpen(false);
                }}
                disabled={option.disabled}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {view === "active" ? (
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter suggestions">
                {[
                  { value: "all", label: "All", count: filteredActiveSuggestions.length },
                  { value: "starred", label: "Starred", count: starredCount },
                  { value: "unstarred", label: "Unstarred", count: unstarredCount },
                ].map((option) => {
                const isActive = filter === option.value;
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
                      setFilter(option.value as typeof filter);
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
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Sort suggestions">
            {sortOptions.map((option) => {
              const isActive = currentSort === option.value;
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
                    handleSortChange(option.value);
                    setIsFilterOpen(false);
                  }}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "deleted" ? (
        <DeletedSuggestionList suggestions={deleted} />
      ) : view === "completed" ? (
        completedSuggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Finished suggestions will appear here for reference.</p>
        ) : (
          <div className="space-y-4">
            {completedSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                mode="developer"
                onOpen={() => router.push(`/dashboard/suggestions/${suggestion.id}`)}
              />
            ))}
          </div>
        )
      ) : (
        <SuggestionList suggestions={filteredActiveSuggestions} query={query} canReorder={canReorder} />
      )}
    </div>
  );
}
