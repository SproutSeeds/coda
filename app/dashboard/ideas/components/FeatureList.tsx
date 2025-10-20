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
import { ChevronDown, GripVertical, Star as StarIcon } from "lucide-react";
import { toast } from "sonner";

import { reorderFeaturesAction } from "../actions";
import type { Feature } from "./types";
import { FeatureCard } from "./FeatureCard";
import { useFeatureSectionCollapse } from "./hooks/useFeatureSectionCollapse";
import { cn } from "@/lib/utils";
import { FEATURE_SUPER_STAR_LIMIT } from "@/lib/constants/features";

type FeatureActiveSectionKey = "superstars" | "stars" | "unstarred";

const SECTION_CONFIG = [
  {
    key: "superstars",
    label: "Superstars",
    emptyMessage: "No superstar features yet—promote your favorites.",
  },
  {
    key: "stars",
    label: "Stars",
    emptyMessage: "No starred features yet.",
  },
  {
    key: "unstarred",
    label: "Unstarred",
    emptyMessage: "Capture more detail to round out this list.",
  },
] as const satisfies ReadonlyArray<{
  key: FeatureActiveSectionKey;
  label: string;
  emptyMessage: string;
}>;

type SectionData = (typeof SECTION_CONFIG)[number] & {
  totalCount: number;
  visibleItems: Feature[];
  maxIndex: number;
};

function getSectionKey(feature: Feature): FeatureActiveSectionKey {
  if (feature.superStarred) {
    return "superstars";
  }
  if (feature.starred) {
    return "stars";
  }
  return "unstarred";
}

export function FeatureList({
  ideaId,
  features,
  emptyLabel,
  canReorder = true,
  showCompletedSection = true,
}: {
  ideaId: string;
  features: Feature[];
  emptyLabel?: string;
  canReorder?: boolean;
  showCompletedSection?: boolean;
}) {
  const [activeItems, setActiveItems] = useState(() =>
    showCompletedSection ? features.filter((feature) => !feature.completed) : features,
  );
  const serverSuperStarTotal = useMemo(
    () => features.filter((feature) => feature.superStarred && !feature.completed).length,
    [features],
  );
  const [superStarTotal, setSuperStarTotal] = useState(serverSuperStarTotal);
  const previousItemsRef = useRef(activeItems);
  const [isPending, startTransition] = useTransition();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isMounted, setIsMounted] = useState(false);
  const pageSize = 5;
  const [visibleActiveCount, setVisibleActiveCount] = useState(pageSize);
  const activeSentinelRef = useRef<HTMLDivElement | null>(null);
  const [collapsedSections, setCollapsedSections] = useFeatureSectionCollapse(ideaId);

  const completedFeatures = useMemo(() => {
    if (!showCompletedSection) {
      return [] as Feature[];
    }
    const items = features.filter((feature) => feature.completed);
    const ordered = items.slice().sort((a, b) => {
      if (!a.completedAt && !b.completedAt) return 0;
      if (!a.completedAt) return 1;
      if (!b.completedAt) return -1;
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });
    return ordered;
  }, [features, showCompletedSection]);
  const completedSuperStarCount = useMemo(
    () => completedFeatures.filter((feature) => feature.superStarred).length,
    [completedFeatures],
  );

  useEffect(() => {
    setSuperStarTotal(serverSuperStarTotal);
  }, [serverSuperStarTotal]);

  const adjustSuperStarTotal = useCallback((delta: number) => {
    if (delta === 0) return;
    setSuperStarTotal((previous) => {
      const next = previous + delta;
      if (next < 0) {
        return 0;
      }
      if (next > FEATURE_SUPER_STAR_LIMIT) {
        return FEATURE_SUPER_STAR_LIMIT;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const nextActive = showCompletedSection ? features.filter((feature) => !feature.completed) : features;
    setActiveItems(nextActive);
    previousItemsRef.current = nextActive;
    setVisibleActiveCount(pageSize);
  }, [features, showCompletedSection, pageSize]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadMoreActive = useCallback(() => {
    setVisibleActiveCount((previous) => Math.min(activeItems.length, previous + pageSize));
  }, [activeItems.length, pageSize]);

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
    previousItemsRef.current = activeItems;
  };

  const handleDragCancel = () => {
    setActiveItems(previousItemsRef.current);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = activeItems.findIndex((item) => item.id === active.id);
    const newIndex = activeItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const previous = previousItemsRef.current;
    const reordered = arrayMove(activeItems, oldIndex, newIndex);
    setActiveItems(reordered);

    const orderedIds = reordered.map((item) => item.id);

    startTransition(async () => {
      try {
        await reorderFeaturesAction(ideaId, orderedIds);
      } catch (error) {
        setActiveItems(previous);
        toast.error(error instanceof Error ? error.message : "Unable to reorder features");
      }
    });
  };

  const hasActive = showCompletedSection ? activeItems.length > 0 : features.length > 0;
  const allowReorder = canReorder && showCompletedSection && hasActive && isMounted;
  const hasCompleted = showCompletedSection && completedFeatures.length > 0;
  const visibleActiveItems = activeItems.slice(0, visibleActiveCount);
  const hasMoreActive = visibleActiveCount < activeItems.length;

  const sections = useMemo<SectionData[]>(() => {
    const meta: Record<FeatureActiveSectionKey, { total: number; visible: Feature[]; maxIndex: number }> = {
      superstars: { total: 0, visible: [], maxIndex: -1 },
      stars: { total: 0, visible: [], maxIndex: -1 },
      unstarred: { total: 0, visible: [], maxIndex: -1 },
    };

    activeItems.forEach((feature, index) => {
      const key = getSectionKey(feature);
      meta[key].total += 1;
      meta[key].maxIndex = index;
    });

    visibleActiveItems.forEach((feature) => {
      const key = getSectionKey(feature);
      meta[key].visible.push(feature);
    });

    return SECTION_CONFIG.map((config) => ({
      ...config,
      totalCount: meta[config.key].total,
      visibleItems: meta[config.key].visible,
      maxIndex: meta[config.key].maxIndex,
    }));
  }, [activeItems, visibleActiveItems]);

  const renderedActiveFeatures = useMemo(() => {
    const rendered: Feature[] = [];
    for (const section of sections) {
      if (collapsedSections[section.key]) {
        continue;
      }
      rendered.push(...section.visibleItems);
    }
    return rendered;
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
    if (!isMounted) {
      return;
    }

    const sentinel = activeSentinelRef.current;
    if (!sentinel || !hasMoreActive) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadMoreActive();
        }
      }
    }, { rootMargin: "200px 0px" });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreActive, loadMoreActive, isMounted]);

  useEffect(() => {
    if (!showCompletedSection) {
      return;
    }
    if (highestExpandedIndex < 0) {
      return;
    }
    setVisibleActiveCount((previous) => {
      if (previous > highestExpandedIndex) {
        return previous;
      }
      const next = Math.min(activeItems.length, highestExpandedIndex + 1);
      return next > previous ? next : previous;
    });
  }, [activeItems.length, highestExpandedIndex, showCompletedSection]);

  const toggleSection = useCallback(
    (key: FeatureActiveSectionKey) => {
      const wasCollapsed = collapsedSections[key];
      const section = sections.find((entry) => entry.key === key);
      setCollapsedSections((previous) => ({
        ...previous,
        [key]: !previous[key],
      }));
      if (!showCompletedSection) {
        return;
      }
      if (wasCollapsed && section && section.maxIndex >= 0) {
        const requiredCount = section.maxIndex + 1;
        setVisibleActiveCount((previous) =>
          Math.max(previous, Math.min(activeItems.length, requiredCount)),
        );
      }
    },
    [activeItems.length, collapsedSections, sections, setCollapsedSections, showCompletedSection],
  );

  const renderSections = useCallback(
    (renderFeature: (feature: Feature) => ReactNode) =>
      sections.map((section) => {
        const contentId = `feature-section-${section.key}`;
        const isCollapsed = collapsedSections[section.key];
        const hasVisibleFeatures = section.visibleItems.length > 0;
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
                  className="space-y-3"
                >
                  {hasVisibleFeatures
                    ? section.visibleItems.map((feature) => renderFeature(feature))
                    : isEmptySection
                      ? (
                        <p className="text-sm text-muted-foreground">{section.emptyMessage}</p>
                      )
                      : (
                        <p className="text-xs text-muted-foreground">
                          Scroll to reveal more features in this section.
                        </p>
                      )}
                </motion.div>
              ) : null}
            </AnimatePresence>
            {isCollapsed && section.totalCount > 0 ? (
              <p className="pl-1 text-xs text-muted-foreground">
                {section.totalCount === 1
                  ? "1 feature hidden"
                  : `${section.totalCount} features hidden`}
              </p>
            ) : null}
          </div>
        );
      }),
    [collapsedSections, sections, toggleSection],
  );

  const toggleCompletedSection = useCallback(() => {
    setCollapsedSections((previous) => ({
      ...previous,
      completed: !previous.completed,
    }));
  }, [setCollapsedSections]);

  const completedContentId = "feature-section-completed";
  const isCompletedCollapsed = collapsedSections.completed;

  const header = (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Features</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Super stars</span>
            <span className={cn(superStarTotal >= FEATURE_SUPER_STAR_LIMIT ? "text-primary" : "text-foreground")}>
              {superStarTotal}
            </span>
            <span className="text-muted-foreground">/ {FEATURE_SUPER_STAR_LIMIT}</span>
          </span>
        </div>
      </div>
      {completedSuperStarCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {completedSuperStarCount === 1
            ? "1 super star lives in Completed. Expand that section to manage it."
            : `${completedSuperStarCount} super stars live in Completed. Expand that section to manage them.`}
        </p>
      ) : null}
    </div>
  );

  if (!hasActive && !hasCompleted) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-sm text-muted-foreground">{emptyLabel ?? "No features yet. Add one to start shaping this idea."}</p>
      </div>
    );
  }

  if (!showCompletedSection) {
    return (
      <div className="space-y-4" data-testid="feature-list">
        {header}
        <div className="space-y-3">
          {visibleActiveItems.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              ideaId={ideaId}
              superStarTotal={superStarTotal}
              onSuperStarCountChange={adjustSuperStarTotal}
              isDragging={false}
            />
          ))}
          {hasMoreActive ? <div ref={activeSentinelRef} className="h-6" aria-hidden /> : null}
        </div>
      </div>
    );
  }

  const renderCompletedSection = hasCompleted ? (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggleCompletedSection}
        aria-expanded={!isCompletedCollapsed}
        aria-controls={completedContentId}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/40 bg-muted/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-[0.7rem]">
            ✓
          </span>
          Completed
          <span className="font-normal text-muted-foreground/80">
            ({completedFeatures.length})
          </span>
          {completedSuperStarCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-300/90">
              <StarIcon className="size-3" aria-hidden />
              {completedSuperStarCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200",
            isCompletedCollapsed ? "-rotate-90" : "rotate-0",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {!isCompletedCollapsed ? (
          <motion.div
            key="completed-content"
            id={completedContentId}
            layout
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="space-y-3"
            data-testid="feature-completed-list"
          >
            {completedFeatures.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                ideaId={ideaId}
                superStarTotal={superStarTotal}
                onSuperStarCountChange={adjustSuperStarTotal}
                isDragging={false}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {isCompletedCollapsed ? (
        <p className="pl-1 text-xs text-muted-foreground">
          {completedFeatures.length === 1
            ? "1 completed feature hidden"
            : `${completedFeatures.length} completed features hidden`}
        </p>
      ) : null}
    </div>
  ) : null;

  const renderStaticFeature = (feature: Feature) => (
    <FeatureCard
      key={feature.id}
      feature={feature}
      ideaId={ideaId}
      superStarTotal={superStarTotal}
      onSuperStarCountChange={adjustSuperStarTotal}
      isDragging={false}
    />
  );

  if (!isMounted || !allowReorder) {
    return (
      <div className="space-y-6" data-testid="feature-list">
        {hasActive ? (
          <div className="space-y-5">
            {renderSections(renderStaticFeature)}
            {hasMoreActive ? <div ref={activeSentinelRef} className="h-6" aria-hidden /> : null}
          </div>
        ) : null}
        {renderCompletedSection}
      </div>
    );
  }

  const renderSortableFeature = (feature: Feature) => (
    <SortableFeatureCard
      key={feature.id}
      feature={feature}
      ideaId={ideaId}
      superStarTotal={superStarTotal}
      onSuperStarCountChange={adjustSuperStarTotal}
      isSaving={isPending}
      prefersReducedMotion={prefersReducedMotion}
    />
  );
  const sortableIds = renderedActiveFeatures.map((item) => item.id);

  return (
    <div className="space-y-6" data-testid="feature-list">
      {header}
      {hasActive ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-5">{renderSections(renderSortableFeature)}</div>
          </SortableContext>
          {hasMoreActive ? <div ref={activeSentinelRef} className="h-6" aria-hidden /> : null}
        </DndContext>
      ) : null}
      {renderCompletedSection}
    </div>
  );
}

function SortableFeatureCard({
  feature,
  ideaId,
  superStarTotal,
  onSuperStarCountChange,
  isSaving,
  prefersReducedMotion,
}: {
  feature: Feature;
  ideaId: string;
  superStarTotal: number;
  onSuperStarCountChange: (delta: number) => void;
  isSaving: boolean;
  prefersReducedMotion: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: feature.id });

  const style: CSSProperties = {
    transform: transform && !prefersReducedMotion ? CSS.Transform.toString(transform) : undefined,
    transition: prefersReducedMotion ? undefined : transition ?? undefined,
  };

  const handle = (
    <button
      type="button"
      aria-label="Reorder feature"
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
      <FeatureCard
        feature={feature}
        ideaId={ideaId}
        superStarTotal={superStarTotal}
        onSuperStarCountChange={onSuperStarCountChange}
        dragHandle={handle}
        isDragging={isDragging}
      />
    </div>
  );
}
