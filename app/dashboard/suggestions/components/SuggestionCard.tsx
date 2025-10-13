"use client";

import type { CSSProperties, MouseEventHandler, ReactNode, SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";
import { Copy, Star, StarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  deleteSuggestionAction,
  restoreSuggestionAction,
  toggleSuggestionStarAction,
} from "../actions";
import type { Suggestion } from "./types";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
  } catch {
    return value;
  }
}

export function SuggestionCard({
  suggestion,
  dragHandle,
  isDragging = false,
  style,
  mode = "developer",
  onOpen,
}: {
  suggestion: Suggestion;
  dragHandle?: ReactNode;
  isDragging?: boolean;
  style?: CSSProperties;
  mode?: "developer" | "submitter";
  onOpen?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDetails, setShowDetails] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const deletePrompt = useMemo(() => `Enter "${suggestion.title}" to delete`, [suggestion.title]);
  const deleteTitleMatches = deleteInput.trim() === suggestion.title;
  const isSubmitterView = mode === "submitter";
  const trimmedNotes = suggestion.notes?.trim?.() ?? "";
  const suggestionMarkdown = useMemo(() => {
    const header = `## Suggestion: ${suggestion.title}`;
    const body = trimmedNotes || "_No details provided._";
    return `${header}\n\n${body}`.trim();
  }, [suggestion.title, trimmedNotes]);

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

  const updatedLabel = formatDate(suggestion.updatedAt ?? suggestion.createdAt);
  const handleStar: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    const nextValue = !suggestion.starred;
    startTransition(async () => {
      try {
        await toggleSuggestionStarAction(suggestion.id, nextValue);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to update star status");
      }
    });
  };

  const handleCopy: MouseEventHandler<HTMLButtonElement> = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(suggestionMarkdown);
      toast.success("Copied suggestion to clipboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to copy suggestion");
    }
  };

  const stopPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleDelete: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    setIsConfirmingDelete(true);
    setDeleteInput("");
  };

  const handleConfirmDelete: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    if (!deleteTitleMatches) {
      toast.error("Title didn't match. Suggestion not deleted.");
      return;
    }

    startTransition(async () => {
      try {
        const undo = await deleteSuggestionAction({ id: suggestion.id });
        toast.success("Suggestion archived", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await restoreSuggestionAction({ id: suggestion.id, token: undo.undoToken });
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Unable to restore suggestion");
              }
            },
          },
        });
        resetDeleteConfirmation();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete suggestion");
      }
    });
  };

  const notePreview = trimmedNotes.length > 240 ? `${trimmedNotes.slice(0, 240)}…` : trimmedNotes;

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
        data-testid="suggestion-card"
        role="article"
        tabIndex={0}
        className={cn(
          "group flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-4 text-left",
          "transition-transform duration-200 ease-out transform-gpu",
          "hover:-translate-y-0.5 hover:scale-[1.006] hover:rotate-[0.18deg] hover:border-primary hover:bg-card",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:-translate-y-0.5 focus-visible:scale-[1.004] focus-visible:rotate-[0.14deg]",
          "cursor-pointer hover:cursor-pointer",
        )}
        onClick={() => {
          if (onOpen) {
            onOpen();
          } else if (isSubmitterView) {
            void router.push(`/dashboard/suggestions/${suggestion.id}`);
          }
        }}
      >
        <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
          {dragHandle ? (
            <div onClick={stopPropagation} onKeyDown={stopPropagation} className="shrink-0">
              {dragHandle}
            </div>
          ) : null}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="truncate text-base font-semibold text-foreground">{suggestion.title}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {suggestion.completed ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-emerald-600">
                      Completed
                    </span>
                  ) : null}
                  {suggestion.submittedEmail ? (
                    <span className="uppercase tracking-wide">Submitted by {suggestion.submittedEmail}</span>
                  ) : null}
                </div>
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
                    aria-label="Copy suggestion details"
                    data-testid="suggestion-copy-button"
                  >
                    <Copy className="size-4" />
                  </Button>
                  {!isSubmitterView ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-muted-foreground focus-visible:ring-0",
                          suggestion.starred && "text-yellow-400",
                        )}
                        onClick={handleStar}
                        aria-label={suggestion.starred ? "Unstar suggestion" : "Star suggestion"}
                        data-testid="suggestion-star-button"
                      >
                        {suggestion.starred ? <Star className="size-4 fill-current" /> : <StarOff className="size-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-destructive focus-visible:ring-0"
                        onClick={handleDelete}
                        aria-label="Delete suggestion"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            {trimmedNotes ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {showDetails ? trimmedNotes : notePreview}
                </p>
                {trimmedNotes.length > notePreview.length ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowDetails((prev) => !prev);
                    }}
                  >
                    {showDetails ? "Show less" : "Show more"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {!isSubmitterView && isConfirmingDelete ? (
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-4" onClick={stopPropagation} onKeyDown={stopPropagation}>
            <p className="text-sm font-semibold text-foreground">Confirm deletion</p>
            <p className="text-xs text-muted-foreground">{deletePrompt}</p>
            <Input
              value={deleteInput}
              onChange={(event) => setDeleteInput(event.target.value)}
              autoFocus
              placeholder={suggestion.title}
              disabled={isPending}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={isPending || !deleteTitleMatches}>
                Delete suggestion
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetDeleteConfirmation} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}
