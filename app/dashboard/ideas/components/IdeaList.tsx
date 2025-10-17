"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties, ReactNode } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { reorderIdeasAction } from "../actions";
import { IdeaCard } from "./IdeaCard";
import type { Idea } from "./types";
import { useIdeaSectionCollapse, type IdeaSectionKey } from "./hooks/useIdeaSectionCollapse";

type IdeaListProps = {
  ideas: Idea[];
  query?: string;
  canReorder?: boolean;
  pageSize?: number;
  userId?: string;
};

const SECTION_CONFIG = [
  {
    key: "superstars",
    label: "Superstars",
    emptyMessage: "No superstars yet—promote your top ideas.",
  },
  {
    key: "stars",
    label: "Stars",
    emptyMessage: "No starred ideas yet.",
  },
  {
    key: "unstarred",
    label: "Unstarred",
    emptyMessage: "Sketch what's on your mind to fill this section.",
  },
] as const satisfies ReadonlyArray<{ key: IdeaSectionKey; label: string; emptyMessage: string }>;

type SectionData = (typeof SECTION_CONFIG)[number] & {
  totalCount: number;
  visibleItems: Idea[];
  maxIndex: number;
};

function getSectionKey(idea: Idea): IdeaSectionKey {
  if (idea.superStarred) {
    return "superstars";
  }
  if (idea.starred) {
    return "stars";
  }
  return "unstarred";
}

export function IdeaList({
  ideas,
  query,
  canReorder = true,
  pageSize = 5,
  userId,
}: IdeaListProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [items, setItems] = useState<Idea[]>(ideas);
  const [collapsedSections, setCollapsedSections] = useIdeaSectionCollapse(userId);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isPending, startTransition] = useTransition();
  const previousItemsRef = useRef<Idea[]>(ideas);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setItems(ideas);
    previousItemsRef.current = ideas;
    setVisibleCount(pageSize);
  }, [ideas, pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((previous) => Math.min(items.length, previous + pageSize));
  }, [items.length, pageSize]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = () => {
    previousItemsRef.current = items;
  };

  const handleDragCancel = () => {
    setItems(previousItemsRef.current);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const previous = previousItemsRef.current;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    const orderedIds = reordered.map((item) => item.id);

    startTransition(async () => {
      try {
        await reorderIdeasAction(orderedIds);
      } catch (error) {
        setItems(previous);
        toast.error(error instanceof Error ? error.message : "Unable to reorder ideas");
      }
    });
  };

  const visibleIdeas = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const isEmpty = items.length === 0;
  const isFiltering = Boolean(query && query.trim().length > 0);

  const sections = useMemo<SectionData[]>(() => {
    const meta: Record<IdeaSectionKey, { total: number; visible: Idea[]; maxIndex: number }> = {
      superstars: { total: 0, visible: [], maxIndex: -1 },
      stars: { total: 0, visible: [], maxIndex: -1 },
      unstarred: { total: 0, visible: [], maxIndex: -1 },
    };

    items.forEach((idea, index) => {
      const key = getSectionKey(idea);
      meta[key].total += 1;
      meta[key].maxIndex = index;
    });

    visibleIdeas.forEach((idea) => {
      const key = getSectionKey(idea);
      meta[key].visible.push(idea);
    });

    return SECTION_CONFIG.map((config) => ({
      ...config,
      totalCount: meta[config.key].total,
      visibleItems: meta[config.key].visible,
      maxIndex: meta[config.key].maxIndex,
    }));
  }, [items, visibleIdeas]);

  const renderedIdeas = useMemo(() => {
    const active: Idea[] = [];
    for (const section of sections) {
      if (collapsedSections[section.key]) {
        continue;
      }
      active.push(...section.visibleItems);
    }
    return active;
  }, [collapsedSections, sections]);

  const highestExpandedIndex = useMemo(() => {
    let maxIndex = -1;
    for (const section of sections) {
      if (collapsedSections[section.key]) {
        continue;
      }
      if (section.maxIndex > maxIndex) {
        maxIndex = section.maxIndex;
      }
    }
    return maxIndex;
  }, [collapsedSections, sections]);

  useEffect(() => {
    if (highestExpandedIndex < 0) {
      return;
    }
    setVisibleCount((previous) => {
      if (previous > highestExpandedIndex) {
        return previous;
      }
      const next = Math.min(items.length, highestExpandedIndex + 1);
      return next > previous ? next : previous;
    });
  }, [highestExpandedIndex, items.length]);

  const toggleSection = useCallback(
    (key: IdeaSectionKey) => {
      const wasCollapsed = collapsedSections[key];
      const section = sections.find((entry) => entry.key === key);
      setCollapsedSections((previous) => ({
        ...previous,
        [key]: !previous[key],
      }));
      if (wasCollapsed && section && section.maxIndex >= 0) {
        const requiredCount = section.maxIndex + 1;
        setVisibleCount((previous) => Math.max(previous, Math.min(items.length, requiredCount)));
      }
    },
    [collapsedSections, sections, setCollapsedSections, items.length],
  );

  const renderSections = useCallback(
    (renderIdea: (idea: Idea) => ReactNode) =>
      sections.map((section) => {
        const contentId = `idea-section-${section.key}`;
        const isCollapsed = collapsedSections[section.key];
        const hasVisibleIdeas = section.visibleItems.length > 0;
        const isEmptySection = section.totalCount === 0;

        return (
          <div key={section.key} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              aria-expanded={!isCollapsed}
              aria-controls={contentId}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/40 bg-muted/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="flex items-center gap-2">
                {section.label}
                <span className="font-normal text-muted-foreground/80">
                  ({section.totalCount})
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  isCollapsed ? "-rotate-90" : "rotate-0",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {!isCollapsed ? (
                <motion.div
                  key="content"
                  id={contentId}
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                  className="space-y-4"
                >
                  {hasVisibleIdeas
                    ? section.visibleItems.map((idea) => renderIdea(idea))
                    : isEmptySection
                      ? (
                        <p className="text-sm text-muted-foreground">{section.emptyMessage}</p>
                      )
                      : (
                        <p className="text-xs text-muted-foreground">
                          Scroll to reveal more ideas in this section.
                        </p>
                      )}
                </motion.div>
              ) : null}
            </AnimatePresence>
            {isCollapsed && section.totalCount > 0 ? (
              <p className="pl-1 text-xs text-muted-foreground">
                {section.totalCount === 1 ? "1 idea hidden" : `${section.totalCount} ideas hidden`}
              </p>
            ) : null}
          </div>
        );
      }),
    [collapsedSections, sections, toggleSection],
  );

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadMore();
        }
      }
    }, { rootMargin: "200px 0px" });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isMounted, loadMore]);

  if (isEmpty) {
    return (
      <p className="text-sm text-muted-foreground">
        {query ? "No ideas match your search." : "No ideas yet. Capture your first thought to get started."}
      </p>
    );
  }

  if (!isMounted || !canReorder || isFiltering) {
    const renderStaticIdea = (idea: Idea) => <IdeaCard key={idea.id} idea={idea} />;
    return (
      <div className="space-y-5">
        {renderSections(renderStaticIdea)}
        {hasMore ? <div ref={sentinelRef} className="h-6" aria-hidden /> : null}
      </div>
    );
  }

  const itemIds = items.map((item) => item.id);
  const sortableIds = canReorder && isMounted ? renderedIdeas.map((item) => item.id) : itemIds;
  const renderSortableIdea = (idea: Idea) => (
    <SortableIdeaCard
      key={idea.id}
      idea={idea}
      isSaving={isPending}
      prefersReducedMotion={prefersReducedMotion}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-5">
          {renderSections(renderSortableIdea)}
        </div>
      </SortableContext>
      {hasMore ? <div ref={sentinelRef} className="h-6" aria-hidden /> : null}
    </DndContext>
  );
}

function SortableIdeaCard({
  idea,
  isSaving,
  prefersReducedMotion,
}: {
  idea: Idea;
  isSaving: boolean;
  prefersReducedMotion: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id });

  const style: CSSProperties = {
    transform:
      transform && !prefersReducedMotion ? CSS.Transform.toString(transform) : undefined,
    transition: prefersReducedMotion ? undefined : transition ?? undefined,
  };

  const handle = (
    <button
      type="button"
      aria-label="Reorder idea"
      className="interactive-btn inline-flex items-center justify-center rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isSaving}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <IdeaCard idea={idea} dragHandle={handle} isDragging={isDragging} />
    </div>
  );
}
