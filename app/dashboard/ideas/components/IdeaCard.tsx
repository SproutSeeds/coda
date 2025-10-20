"use client";

import type {
  CSSProperties,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  SyntheticEvent,
} from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";
import { Copy, Sparkles, Star, StarOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { cycleIdeaStarAction, deleteIdeaAction, restoreIdeaAction } from "../actions";
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
  const trimmedNotes = idea.notes?.trim?.() ?? "";
  const ideaMarkdown = useMemo(() => {
    const header = `## Idea: ${idea.title}`;
    const body = trimmedNotes || "_No notes yet._";
    return `${header}\n\n${body}`.trim();
  }, [idea.title, trimmedNotes]);

  const resetDeleteConfirmation = useCallback(() => {
    setIsConfirmingDelete(false);
    setDeleteInput("");
  }, []);

  const blurActiveElement = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
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
      blurActiveElement();
      resetDeleteConfirmation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blurActiveElement, isConfirmingDelete, resetDeleteConfirmation]);

  const updatedLabel = formatUpdated(idea.updatedAt ?? idea.createdAt);
  const starState = idea.superStarred ? "super" : idea.starred ? "star" : "none";
  const starLabel = starState === "super" ? "Remove super star" : starState === "star" ? "Promote to super star" : "Star idea";
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

  const confirmDelete = useCallback(() => {
    if (isPending) {
      return;
    }
    if (deleteInput.trim() !== idea.title) {
      toast.error("Title didn't match. Idea not deleted.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await deleteIdeaAction({ id: idea.id });
        showUndoToast({
          message: "Idea deleted",
          expiresAt: result.expiresAt,
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
  }, [deleteInput, idea.id, idea.title, isPending, resetDeleteConfirmation, startTransition]);

  const handleConfirmDelete: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    confirmDelete();
  };

  const stopPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const stopKeyDownPropagation: KeyboardEventHandler<HTMLElement> = (event) => {
    if (event.key === "Escape") {
      return;
    }
    event.stopPropagation();
  };

  const handleStar: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    startTransition(async () => {
      try {
        const result = await cycleIdeaStarAction(idea.id);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update star status";
        toast.error(message);
      }
    });
  };

  const handleCopy: MouseEventHandler<HTMLButtonElement> = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(ideaMarkdown);
      toast.success("Copied idea to clipboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to copy idea");
    }
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
        data-idea-id={idea.id}
        role="button"
        tabIndex={0}
        onClick={handleNavigate}
        onKeyDown={handleKeyDown}
        className={cn(
          "group flex flex-col gap-3 rounded-xl border border-border/45 bg-card/40 p-4 text-left backdrop-blur-[6px] shadow-[0_22px_65px_-38px_rgba(15,23,42,0.6)]",
          "cursor-pointer transform-gpu transition-transform duration-200 ease-out",
          "hover:-translate-y-0.5 hover:scale-[1.006] hover:rotate-[0.18deg] hover:border-primary/75 hover:bg-card/55 hover:shadow-[0_28px_75px_-34px_rgba(59,130,246,0.5)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:-translate-y-0.5 focus-visible:scale-[1.004] focus-visible:rotate-[0.14deg]",
        )}
      >
        <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
          {dragHandle ? (
            <div onClick={stopPropagation} onKeyDown={stopKeyDownPropagation} className="shrink-0">
              {dragHandle}
            </div>
          ) : null}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="line-clamp-2 break-words text-base font-semibold leading-snug text-foreground">
                  {idea.title}
                </h3>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
                <AnimatePresence initial={false} mode="wait">
                  {showDetails ? (
                    <motion.button
                      key="hide-details"
                      type="button"
                      className="order-2 inline-flex cursor-pointer items-center text-xs font-medium text-primary underline-offset-4 transition hover:underline sm:order-none"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowDetails(false);
                      }}
                    >
                      Hide details
                    </motion.button>
                  ) : null}
                </AnimatePresence>
                <span className="order-3 w-full whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground/80 sm:order-none sm:w-auto">
                  Updated {updatedLabel}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                    onClick={handleCopy}
                    aria-label="Copy idea details"
                    data-testid="idea-copy-button"
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0",
                      starState === "star" && "text-yellow-400 hover:text-yellow-300",
                      starState === "super" && "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)] hover:text-amber-200",
                    )}
                    onClick={handleStar}
                    aria-label={starLabel}
                    aria-pressed={idea.starred}
                    data-testid="idea-star-button"
                    data-star-state={starState}
                  >
                    {starState === "super" ? (
                      <span className="relative inline-flex items-center justify-center">
                        <Star className="size-4 fill-current" />
                        <Sparkles className="absolute -top-2 -right-2 size-3 text-amber-200" aria-hidden="true" />
                      </span>
                    ) : starState === "star" ? (
                      <Star className="size-4 fill-current" />
                    ) : (
                      <StarOff className="size-4" />
                    )}
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
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      confirmDelete();
                    }
                  }}
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
