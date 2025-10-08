"use client";

import type { CSSProperties, KeyboardEventHandler, MouseEventHandler, ReactNode, SyntheticEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { deleteIdeaAction, restoreIdeaAction } from "../actions";
import { showUndoToast } from "./UndoSnackbar";
import type { Idea } from "./types";
import { cn } from "@/lib/utils";

function formatUpdated(value: string) {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(date);
  } catch {
    return value;
  }
}

export function IdeaCard({
  idea,
  dragHandle,
  isDragging = false,
  style,
}: {
  idea: Idea;
  dragHandle?: ReactNode;
  isDragging?: boolean;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDetails, setShowDetails] = useState(false);

  const updatedLabel = formatUpdated(idea.updatedAt ?? idea.createdAt);
  const trimmedNotes = idea.notes?.trim?.() ?? "";
  const preview =
    trimmedNotes.length > 160 ? `${trimmedNotes.slice(0, 157).trimEnd()}…` : trimmedNotes;

  const handleNavigate = () => {
    router.push(`/dashboard/ideas/${idea.id}`);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleNavigate();
    }
  };

  const handleDelete: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    startTransition(async () => {
      try {
        const result = await deleteIdeaAction({ id: idea.id });
        showUndoToast({
          message: "Idea deleted",
          onUndo: async () => {
            await restoreIdeaAction({ id: idea.id, token: result.undoToken });
            toast.success("Idea restored");
          },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete idea");
      }
    });
  };

  const stopPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={style}
      className={cn(isDragging && "opacity-80")}
    >
      <Card
        data-testid="idea-card"
        role="button"
        tabIndex={0}
        onClick={handleNavigate}
        onKeyDown={handleKeyDown}
        className={cn(
          "group flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-4 text-left transition cursor-pointer",
          "hover:border-primary hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <div className="flex items-start gap-3">
          {dragHandle ? (
            <div onClick={stopPropagation} onKeyDown={stopPropagation} className="shrink-0">
              {dragHandle}
            </div>
          ) : null}
          <div className="flex-1 space-y-2">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">{idea.title}</h3>
              {showDetails ? (
                preview ? (
                  <p className="text-sm text-muted-foreground">{preview}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet—open to add details.</p>
                )
              ) : null}
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Updated {updatedLabel}
            </p>
            <button
              type="button"
              className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 transition hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                setShowDetails((previous) => !previous);
              }}
            >
              {showDetails ? "Hide details" : "More details"}
            </button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDelete}
            disabled={isPending}
            aria-label="Delete idea"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
