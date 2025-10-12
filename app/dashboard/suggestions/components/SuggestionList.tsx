"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { useRouter } from "next/navigation";

import { reorderSuggestionsAction } from "../actions";
import type { Suggestion } from "./types";
import { SuggestionCard } from "./SuggestionCard";

export function SuggestionList({
  suggestions,
  query,
  canReorder = true,
  pageSize = 5,
}: {
  suggestions: Suggestion[];
  query?: string;
  canReorder?: boolean;
  pageSize?: number;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [items, setItems] = useState<Suggestion[]>(suggestions);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isPending, startTransition] = useTransition();
  const previousItemsRef = useRef<Suggestion[]>(suggestions);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setItems(suggestions);
    previousItemsRef.current = suggestions;
    setVisibleCount(pageSize);
  }, [suggestions, pageSize]);

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
        await reorderSuggestionsAction(orderedIds);
      } catch (error) {
        setItems(previous);
        toast.error(error instanceof Error ? error.message : "Unable to reorder suggestions");
      }
    });
  };

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const isEmpty = items.length === 0;
  const isFiltering = Boolean(query && query.trim().length > 0);

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
  }, [hasMore, loadMore, isMounted]);

  if (isEmpty) {
    return (
      <p className="text-sm text-muted-foreground">
        {query ? "No suggestions match your search." : "No suggestions yet. Encourage the team to share their thoughts."}
      </p>
    );
  }

  if (!isMounted || !canReorder || isFiltering) {
    return (
      <div className="space-y-4">
        {visibleItems.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            mode="developer"
            onOpen={() => router.push(`/dashboard/suggestions/${suggestion.id}`)}
          />
        ))}
        {hasMore ? <div ref={sentinelRef} className="h-6" aria-hidden /> : null}
      </div>
    );
  }

  const itemIds = items.map((item) => item.id);
  const sortableIds = canReorder && isMounted ? visibleItems.map((item) => item.id) : itemIds;

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
        <div className="space-y-4">
          {visibleItems.map((suggestion) => (
            <SortableSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              isSaving={isPending}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      </SortableContext>
      {hasMore ? <div ref={sentinelRef} className="h-6" aria-hidden /> : null}
    </DndContext>
  );
}

function SortableSuggestionCard({
  suggestion,
  isSaving,
  prefersReducedMotion,
}: {
  suggestion: Suggestion;
  isSaving: boolean;
  prefersReducedMotion: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: suggestion.id });

  const style: CSSProperties = {
    transform: transform && !prefersReducedMotion ? CSS.Transform.toString(transform) : undefined,
    transition: prefersReducedMotion ? undefined : transition ?? undefined,
  };

  const handle = (
    <button
      type="button"
      aria-label="Reorder suggestion"
      className="interactive-btn cursor-grab text-muted-foreground hover:text-foreground focus-visible:ring-0"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-80" : undefined}>
      <SuggestionCard
        suggestion={suggestion}
        dragHandle={handle}
        isDragging={isSaving || isDragging}
        mode="developer"
        onOpen={() => router.push(`/dashboard/suggestions/${suggestion.id}`)}
      />
    </div>
  );
}
