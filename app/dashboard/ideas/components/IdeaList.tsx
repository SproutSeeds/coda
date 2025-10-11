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

import { reorderIdeasAction } from "../actions";
import { Idea } from "./types";
import { IdeaCard } from "./IdeaCard";
import { Button } from "@/components/ui/button";

export function IdeaList({ ideas, query, canReorder = true, pageSize = 5 }: { ideas: Idea[]; query?: string; canReorder?: boolean; pageSize?: number }) {
  const [isMounted, setIsMounted] = useState(false);
  const [items, setItems] = useState<Idea[]>(ideas);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isPending, startTransition] = useTransition();
  const previousItemsRef = useRef<Idea[]>(ideas);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setItems(ideas);
    previousItemsRef.current = ideas;
    setPage(1);
  }, [ideas]);

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

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {query ? "No ideas match your search." : "No ideas yet. Capture your first thought to get started."}
      </p>
    );
  }

  const isFiltering = Boolean(query && query.trim().length > 0);

  if (!isMounted || !canReorder || isFiltering) {
    return (
      <div className="space-y-4">
        {items.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </div>
    );
  }

  const itemIds = items.map((item) => item.id);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = isMounted ? items.slice((currentPage - 1) * pageSize, currentPage * pageSize) : items;
  const sortableIds = canReorder && isMounted ? paginatedItems.map((item) => item.id) : itemIds;

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
          {paginatedItems.map((idea) => (
            <SortableIdeaCard
              key={idea.id}
              idea={idea}
              isSaving={isPending}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      </SortableContext>
      <div className="mt-4 flex items-center justify-end gap-3 text-xs text-muted-foreground">
        <span>
          Showing {paginatedItems.length} of {items.length} ideas
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
