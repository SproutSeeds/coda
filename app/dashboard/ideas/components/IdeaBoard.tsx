"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { IdeaList } from "./IdeaList";
import { DeletedIdeaList } from "./DeletedIdeaList";
import type { Idea } from "./types";
import { SearchBar } from "./SearchBar";
import { cn } from "@/lib/utils";
import { Funnel } from "lucide-react";
import { exportAllIdeasAsJsonAction } from "../actions";
import { useImportIdeas } from "./hooks/useImportIdeas";
import { ImportIdeasDialog } from "./ImportIdeasDialog";

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
  viewerId,
}: {
  ideas: Idea[];
  deleted: Idea[];
  query?: string;
  sort: string;
  viewerId: string;
}) {
  const [view, setView] = useState<"active" | "deleted">("active");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [ideaFilter, setIdeaFilter] = useState<"all" | "starred" | "unstarred">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [isExportingAll, startExportAllTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const userId = viewerId;
  const ownedSource = useMemo(
    () => ideas.filter((idea) => idea.isOwner),
    [ideas],
  );
  const sharedSource = useMemo(
    () => ideas.filter((idea) => !idea.isOwner),
    [ideas],
  );

  const {
    handleFileChange: handleImportFileChange,
    isPreviewing,
    isCommitting,
    dialogOpen,
    preview,
    rows,
    decisions,
    applyToAllAction,
    updateDecision,
    clearApplyToAll,
    confirmImport,
    resetState: resetImportState,
  } = useImportIdeas({
    onResetInput: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
  });

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
  const ownedCount = ownedSource.length;
  const sharedCount = sharedSource.length;
  const starredOwned = useMemo(
    () => ownedSource.filter((idea) => idea.starred).length,
    [ownedSource],
  );
  const superStarCount = useMemo(
    () => ownedSource.filter((idea) => idea.superStarred).length,
    [ownedSource],
  );
  const unstarredOwned = ownedCount - starredOwned;
  const visibilityCounts = useMemo(() => {
    return ideas.reduce(
      (acc, idea) => {
        if (idea.visibility === "public") {
          acc.public += 1;
        } else {
          acc.private += 1;
        }
        return acc;
      },
      { public: 0, private: 0 },
    );
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    let next = ideas;
    switch (ideaFilter) {
      case "starred":
        next = next.filter((idea) => idea.starred);
        break;
      case "unstarred":
        next = next.filter((idea) => !idea.starred);
        break;
      default:
        break;
    }
    if (visibilityFilter !== "all") {
      next = next.filter((idea) => idea.visibility === visibilityFilter);
    }
    return next;
  }, [ideaFilter, ideas, visibilityFilter]);
  const filteredOwned = useMemo(
    () => filteredIdeas.filter((idea) => idea.isOwner),
    [filteredIdeas],
  );
  const filteredShared = useMemo(
    () => filteredIdeas.filter((idea) => !idea.isOwner),
    [filteredIdeas],
  );

  const handleExportAll = () => {
    startExportAllTransition(async () => {
      try {
        const payload = await exportAllIdeasAsJsonAction();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const anchor = document.createElement("a");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const url = URL.createObjectURL(blob);
        anchor.href = url;
        anchor.download = `coda-ideas-export-${timestamp}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        toast.success("Export ready");
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 0);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to export ideas");
      }
    });
  };

  return (
    <div className="relative space-y-4">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <span className="text-sm font-semibold tracking-wide text-foreground">Ideas</span>
          <p className="text-xs text-muted-foreground">
            My ideas {ownedCount} <span aria-hidden="true">•</span> Shared with me {sharedCount} <span aria-hidden="true">•</span> Super stars {superStarCount}/3
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <SearchBar className="w-full sm:max-w-sm lg:max-w-md" />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            name="ideas-import"
            className="hidden"
            data-testid="ideas-import-input"
            onChange={(event) => {
              handleImportFileChange(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="interactive-btn whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPreviewing || isCommitting}
            data-testid="ideas-import-button"
          >
            {isPreviewing ? "Analyzing…" : isCommitting ? "Importing…" : "Import ideas"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="interactive-btn whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={handleExportAll}
            disabled={isExportingAll}
          >
            {isExportingAll ? "Exporting…" : "Export all ideas"}
          </Button>
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
                { value: "all", label: "All", count: ownedCount },
                { value: "starred", label: "Starred", count: starredOwned },
                { value: "unstarred", label: "Unstarred", count: unstarredOwned },
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
          {view === "active" ? (
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter ideas by visibility">
              {[
                { value: "all", label: "All visibility", count: ideas.length },
                { value: "public", label: "Public", count: visibilityCounts.public },
                { value: "private", label: "Private", count: visibilityCounts.private },
              ].map((option) => {
                const isActive = visibilityFilter === option.value;
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
                      setVisibilityFilter(option.value as typeof visibilityFilter);
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
        <div className="space-y-10">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">My ideas</h2>
              <span className="text-xs text-muted-foreground">{filteredOwned.length} visible</span>
            </div>
            {filteredOwned.length > 0 ? (
              <IdeaList ideas={filteredOwned} query={query} canReorder={canReorder} userId={userId} />
            ) : ownedCount > 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No ideas match the current filters. Update the filters or clear the search to see your ideas again.
              </p>
            ) : (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                You haven&apos;t created any ideas yet. Start sketching by using the composer above.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Shared with me</h2>
              <span className="text-xs text-muted-foreground">
                {filteredShared.length}/{sharedSource.length} visible
              </span>
            </div>
            {sharedSource.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                When teammates share ideas with you, they&apos;ll appear here.
              </p>
            ) : filteredShared.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No shared ideas match the current filters. Adjust the filters to see collaborators&apos; ideas.
              </p>
            ) : (
              <IdeaList ideas={filteredShared} query={query} canReorder={false} userId={userId} />
            )}
          </section>
        </div>
      ) : (
        <DeletedIdeaList ideas={deleted} />
      )}

      <ImportIdeasDialog
        open={dialogOpen}
        summary={preview}
        rows={rows}
        decisions={decisions}
        applyToAllAction={applyToAllAction}
        onDecisionChange={updateDecision}
        onClearApplyToAll={clearApplyToAll}
        onConfirm={confirmImport}
        onClose={resetImportState}
        isCommitting={isCommitting}
      />
    </div>
  );
}
