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

export function FeatureList({
  ideaId,
  features,
  emptyLabel,
}: {
  ideaId: string;
  features: Feature[];
  emptyLabel?: string;
}) {
  const [items, setItems] = useState(features);
  const previousItemsRef = useRef(features);
  const [isPending, startTransition] = useTransition();
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    setItems(features);
    previousItemsRef.current = features;
  }, [features]);

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
        await reorderFeaturesAction(ideaId, orderedIds);
      } catch (error) {
        setItems(previous);
        toast.error(error instanceof Error ? error.message : "Unable to reorder features");
      }
    });
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? "No features yet. Add one to start shaping this idea."}</p>;
  }

  const itemIds = items.map((item) => item.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3" data-testid="feature-list">
          {items.map((feature) => (
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
