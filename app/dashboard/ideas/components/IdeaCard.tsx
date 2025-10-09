"use client";

import type { CSSProperties, KeyboardEventHandler, MouseEventHandler, ReactNode, SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";
import { Star, StarOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { deleteIdeaAction, restoreIdeaAction, toggleIdeaStarAction } from "../actions";
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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const deletePrompt = useMemo(() => `Enter "${idea.title}" to delete`, [idea.title]);
  const deleteTitleMatches = deleteInput.trim() === idea.title;

  const resetDeleteConfirmation = useCallback(() => {
    setIsConfirmingDelete(false);
    setDeleteInput("");
  }, []);

  useEffect(() => {
    if (!isConfirmingDelete) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      resetDeleteConfirmation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isConfirmingDelete, resetDeleteConfirmation]);

  const updatedLabel = formatUpdated(idea.updatedAt ?? idea.createdAt);
  const trimmedNotes = idea.notes?.trim?.() ?? "";

  const handleNavigate = () => {
    router.push(`/dashboard/ideas/${idea.id}`);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleNavigate();
    }
  };

  const handleDeleteClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    setIsConfirmingDelete(true);
    setDeleteInput("");
  };

  const handleConfirmDelete: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    if (deleteInput.trim() !== idea.title) {
      toast.error("Title didn't match. Idea not deleted.");
      return;
    }
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
        resetDeleteConfirmation();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete idea");
      }
    });
  };

  const stopPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleStar: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    const nextValue = !idea.starred;
    startTransition(async () => {
      try {
        await toggleIdeaStarAction(idea.id, nextValue);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to update star status");
      }
    });
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
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="truncate text-base font-semibold text-foreground">{idea.title}</h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AnimatePresence initial={false} mode="wait">
                  {showDetails ? (
                    <motion.button
                      key="hide-details"
                      type="button"
                      className="inline-flex cursor-pointer items-center text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowDetails(false);
                      }}
                    >
                      Hide details
                    </motion.button>
                  ) : null}
                </AnimatePresence>
                <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                  Updated {updatedLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-muted-foreground focus-visible:ring-0",
                    idea.starred && "text-yellow-400",
                  )}
                  onClick={handleStar}
                  aria-label={idea.starred ? "Unstar idea" : "Star idea"}
                  data-testid="idea-star-button"
                >
                  {idea.starred ? <Star className="size-4 fill-current" /> : <StarOff className="size-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="interactive-btn shrink-0 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-destructive focus-visible:ring-0"
                  onClick={handleDeleteClick}
                  disabled={isPending}
                  aria-label="Delete idea"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <AnimatePresence initial={false} mode="wait">
              {showDetails ? (
                trimmedNotes ? (
                  <motion.p
                    key="idea-expanded"
                    layout
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="text-sm text-muted-foreground"
                  >
                    {trimmedNotes}
                  </motion.p>
                ) : (
                  <motion.p
                    key="idea-empty"
                    layout
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="text-sm text-muted-foreground"
                  >
                    No notes yet—open to add details.
                  </motion.p>
                )
              ) : null}
            </AnimatePresence>
            {!showDetails ? (
              <motion.button
                key="show-details"
                type="button"
                className="inline-flex cursor-pointer items-center text-sm font-medium text-primary underline-offset-4 transition hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDetails(true);
                }}
              >
                Show details
              </motion.button>
            ) : null}
          </div>
          <div className="flex items-center gap-1" />
        </div>
        {isConfirmingDelete ? (
          <div
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
            onClick={(event) => event.stopPropagation()}
            data-testid="idea-delete-confirmation"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Input
                  value={deleteInput}
                  onChange={(event) => setDeleteInput(event.target.value)}
                  placeholder={deletePrompt}
                  aria-label={deletePrompt}
                  data-testid="idea-delete-input"
                  className="h-10 w-full pr-10 placeholder:text-muted-foreground/50"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="interactive-btn absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                  onClick={(event) => {
                    event.stopPropagation();
                    resetDeleteConfirmation();
                  }}
                  aria-label="Cancel delete"
                  data-testid="idea-delete-cancel"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="interactive-btn"
                onClick={handleConfirmDelete}
                disabled={isPending || !deleteTitleMatches}
                data-testid="idea-delete-confirm"
              >
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}
