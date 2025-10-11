"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";

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
import { useReducedMotion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

import { reorderFeaturesAction } from "../actions";
import type { Feature } from "./types";
import { FeatureCard } from "./FeatureCard";
import { Button } from "@/components/ui/button";

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
  const previousItemsRef = useRef(activeItems);
  const [isPending, startTransition] = useTransition();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isMounted, setIsMounted] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const completedFeatures = showCompletedSection
    ? features
        .filter((feature) => feature.completed)
        .slice()
        .sort((a, b) => {
          if (!a.completedAt && !b.completedAt) return 0;
          if (!a.completedAt) return 1;
          if (!b.completedAt) return -1;
          return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
        })
    : [];

  useEffect(() => {
    if (showCompletedSection) {
      const nextActive = features.filter((feature) => !feature.completed);
      setActiveItems(nextActive);
      previousItemsRef.current = nextActive;
    } else {
      setActiveItems(features);
      previousItemsRef.current = features;
    }
    setPage(1);
  }, [features, showCompletedSection]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedActiveItems = activeItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!hasActive && !hasCompleted) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? "No features yet. Add one to start shaping this idea."}</p>;
  }

  if (!showCompletedSection) {
    return (
      <div className="space-y-3" data-testid="feature-list">
        {features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} ideaId={ideaId} isDragging={false} />
        ))}
      </div>
    );
  }

  if (!isMounted) {
    return (
      <div className="space-y-6" data-testid="feature-list">
        {hasActive ? (
          <div className="space-y-3">
            {activeItems.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} ideaId={ideaId} isDragging={false} />
            ))}
          </div>
        ) : null}
        {hasCompleted ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-[0.7rem]">✓</span>
              Completed ({completedFeatures.length})
            </div>
            <div className="space-y-3" data-testid="feature-completed-list">
              {completedFeatures.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} ideaId={ideaId} isDragging={false} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const visibleActiveItems = showCompletedSection ? paginatedActiveItems : features;
  const activeIds = visibleActiveItems.map((item) => item.id);

  return (
    <div className="space-y-6" data-testid="feature-list">
      {hasActive ? (
        allowReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={activeIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {visibleActiveItems.map((feature) => (
                  <SortableFeatureCard
                    key={feature.id}
                    feature={feature}
                    ideaId={ideaId}
                    isSaving={isPending}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-3">
            {visibleActiveItems.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} ideaId={ideaId} isDragging={false} />
            ))}
          </div>
        )
      ) : null}

      {hasCompleted ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-[0.7rem]">✓</span>
            Completed ({completedFeatures.length})
          </div>
          <div className="space-y-3" data-testid="feature-completed-list">
            {completedFeatures.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} ideaId={ideaId} isDragging={false} />
            ))}
          </div>
        </div>
      ) : null}

      {hasActive ? (
        <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
          <span>
            Showing {visibleActiveItems.length} of {activeItems.length} active features
          </span>
          {totalPages > 1 ? (
            <div className="inline-flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="interactive-btn px-2 py-1"
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </Button>
              <span className="inline-flex min-w-[3rem] justify-center text-xs font-semibold">
                Page {currentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="interactive-btn px-2 py-1"
                onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SortableFeatureCard({
  feature,
  ideaId,
  isSaving,
  prefersReducedMotion,
}: {
  feature: Feature;
  ideaId: string;
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
      <FeatureCard feature={feature} ideaId={ideaId} dragHandle={handle} isDragging={isDragging} />
    </div>
  );
}
