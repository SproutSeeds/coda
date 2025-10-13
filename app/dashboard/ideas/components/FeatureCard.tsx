"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, Circle, Copy, Star, StarOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const FEATURE_NOTES_CHARACTER_LIMIT = 10_000;

function formatFeatureUpdated(value: string) {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(date);
  } catch {
    return value;
  }
}

import {
  convertFeatureToIdeaAction,
  deleteFeatureAction,
  toggleFeatureCompletionAction,
  toggleFeatureStarAction,
  updateFeatureAction,
} from "../actions";
import type { Feature } from "./types";

const AUTOSAVE_DELAY = 10_000;

export function FeatureCard({
  feature,
  ideaId,
  dragHandle,
  isDragging = false,
  style,
}: {
  feature: Feature;
  ideaId: string;
  dragHandle?: ReactNode;
  isDragging?: boolean;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [draftTitle, setDraftTitle] = useState(feature.title);
  const [draftNotes, setDraftNotes] = useState(feature.notes);
  const [currentTitle, setCurrentTitle] = useState(feature.title);
  const [currentNotes, setCurrentNotes] = useState(feature.notes);
  const [syncedFeature, setSyncedFeature] = useState({
    title: feature.title,
    notes: feature.notes,
    updatedAt: feature.updatedAt,
    completed: feature.completed,
    completedAt: feature.completedAt,
  });
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isStarred, setIsStarred] = useState(feature.starred);
  const [featureAutoState, setFeatureAutoState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const featureAutoTimer = useRef<number | null>(null);
  const featureSaveInFlight = useRef(false);
  const [isMutating, startMutate] = useTransition();
  const [isStarPending, startStarTransition] = useTransition();
  const [isConvertingToIdea, startConvertTransition] = useTransition();
  const [isConfirmingConvert, setIsConfirmingConvert] = useState(false);
  const [isCompletionPending, startCompletionTransition] = useTransition();
  const [isCompleted, setIsCompleted] = useState(Boolean(feature.completed));
  const [completedAt, setCompletedAt] = useState<string | null>(feature.completedAt ?? null);
  const featureMarkdown = useMemo(() => {
    const normalizedTitle = currentTitle?.trim?.() || feature.title;
    const normalizedNotes = currentNotes?.trim?.() ?? "";
    const header = `## Feature: ${normalizedTitle}`;
    const body = normalizedNotes ? normalizedNotes : "_No notes yet._";
    return `${header}\n\n${body}`.trim();
  }, [currentNotes, currentTitle, feature.title]);

  useEffect(() => {
    setCurrentTitle(feature.title);
    setCurrentNotes(feature.notes);
    setDraftTitle(feature.title);
    setDraftNotes(feature.notes);
    setIsStarred(feature.starred);
    setSyncedFeature({
      title: feature.title,
      notes: feature.notes,
      updatedAt: feature.updatedAt,
      completed: feature.completed,
      completedAt: feature.completedAt,
    });
    setIsCompleted(Boolean(feature.completed));
    setCompletedAt(feature.completedAt ?? null);
  }, [feature.completed, feature.completedAt, feature.id, feature.notes, feature.starred, feature.title, feature.updatedAt]);

  const trimmedDraftTitle = draftTitle.trim();
  const trimmedDraftNotes = draftNotes.trim();
  const featureDirty =
    trimmedDraftTitle !== syncedFeature.title || trimmedDraftNotes !== syncedFeature.notes;
  const completionDisplay = isCompleted
    ? completedAt
      ? `Completed ${formatFeatureUpdated(completedAt)}`
      : "Completed"
    : `Updated ${formatFeatureUpdated(syncedFeature.updatedAt)}`;

  const deletePrompt = useMemo(() => `Enter "${currentTitle}" to delete`, [currentTitle]);
  const deleteTitleMatches = deleteInput.trim() === currentTitle;

  const resetDeleteConfirmation = useCallback(() => {
    setIsConfirmingDelete(false);
    setDeleteInput("");
  }, []);

  const cancelEditing = useCallback(() => {
    setDraftTitle(syncedFeature.title);
    setDraftNotes(syncedFeature.notes);
    setIsEditing(false);
    setFeatureAutoState("idle");
    setIsConfirmingConvert(false);
  }, [syncedFeature.notes, syncedFeature.title, setIsConfirmingConvert]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();

      if (isConfirmingDelete) {
        resetDeleteConfirmation();
        return;
      }

      if (isConfirmingConvert) {
        setIsConfirmingConvert(false);
        return;
      }

      if (isEditing) {
        cancelEditing();
        return;
      }

      if (isExpanded) {
        setIsExpanded(false);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelEditing, isConfirmingConvert, isConfirmingDelete, isEditing, isExpanded, resetDeleteConfirmation, setIsConfirmingConvert]);

  const saveFeature = useCallback(
    async (titleValue: string, notesValue: string) => {
      featureSaveInFlight.current = true;
      try {
        const updated = await updateFeatureAction({
          id: feature.id,
          ideaId,
          title: titleValue,
          notes: notesValue,
        });
        setCurrentTitle((previous) => (previous === updated.title ? previous : updated.title));
        setCurrentNotes((previous) => (previous === updated.notes ? previous : updated.notes));
        setDraftTitle((previous) => (previous === updated.title ? previous : updated.title));
        setDraftNotes((previous) => (previous === updated.notes ? previous : updated.notes));
        setSyncedFeature({
          title: updated.title,
          notes: updated.notes,
          updatedAt: updated.updatedAt,
          completed: updated.completed,
          completedAt: updated.completedAt,
        });
        setIsCompleted(Boolean(updated.completed));
        setCompletedAt(updated.completedAt ?? null);
        return updated;
      } finally {
        featureSaveInFlight.current = false;
      }
    },
    [feature.id, ideaId],
  );

  useEffect(() => {
    if (!isEditing) {
      if (featureAutoTimer.current) {
        window.clearTimeout(featureAutoTimer.current);
        featureAutoTimer.current = null;
      }
      return;
    }

    if (!featureDirty) {
      if (featureAutoState === "saving") {
        setFeatureAutoState("saved");
      }
      return;
    }

    if (!trimmedDraftTitle || !trimmedDraftNotes) {
      return;
    }

    if (featureAutoTimer.current) {
      window.clearTimeout(featureAutoTimer.current);
    }

    featureAutoTimer.current = window.setTimeout(() => {
      if (featureSaveInFlight.current) {
        return;
      }
      setFeatureAutoState("saving");
      void saveFeature(trimmedDraftTitle, trimmedDraftNotes)
        .then(() => setFeatureAutoState("saved"))
        .catch((error) => {
          setFeatureAutoState("error");
          toast.error(error instanceof Error ? error.message : "Unable to auto-save feature");
        });
    }, AUTOSAVE_DELAY);

    return () => {
      if (featureAutoTimer.current) {
        window.clearTimeout(featureAutoTimer.current);
        featureAutoTimer.current = null;
      }
    };
  }, [featureAutoState, featureDirty, isEditing, saveFeature, trimmedDraftNotes, trimmedDraftTitle]);

  const handleManualSave = () => {
    if (!trimmedDraftTitle || !trimmedDraftNotes) {
      toast.error("Provide a title and notes to save");
      return;
    }
    setFeatureAutoState("saving");
    void saveFeature(trimmedDraftTitle, trimmedDraftNotes)
      .then(() => {
        setFeatureAutoState("saved");
        setIsEditing(false);
      })
      .catch((error) => {
        setFeatureAutoState("error");
        toast.error(error instanceof Error ? error.message : "Unable to update feature");
      });
  };

  const handleDelete = () => {
    setIsConfirmingDelete(true);
    setDeleteInput("");
  };

  const confirmDelete = useCallback(() => {
    if (isMutating) {
      return;
    }
    if (!deleteTitleMatches) {
      toast.error("Title didn't match. Feature not deleted.");
      return;
    }

    startMutate(async () => {
      try {
        await deleteFeatureAction({ id: feature.id });
        toast.success("Feature removed");
        resetDeleteConfirmation();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to delete feature");
      }
    });
  }, [deleteFeatureAction, deleteTitleMatches, feature.id, isMutating, resetDeleteConfirmation, router, startMutate]);

  const handleToggleStar = () => {
    const next = !isStarred;
    setIsStarred(next);
    startStarTransition(async () => {
      try {
        await toggleFeatureStarAction(feature.id, next);
        router.refresh();
      } catch (error) {
        setIsStarred(!next);
        toast.error(error instanceof Error ? error.message : "Unable to update feature star");
      }
    });
  };

  const handleToggleCompleted = () => {
    const next = !isCompleted;
    startCompletionTransition(async () => {
      try {
        const updated = await toggleFeatureCompletionAction(feature.id, next);
        setIsCompleted(Boolean(updated.completed));
        setCompletedAt(updated.completedAt ?? null);
        setSyncedFeature({
          title: updated.title,
          notes: updated.notes,
          updatedAt: updated.updatedAt,
          completed: updated.completed,
          completedAt: updated.completedAt,
        });
        setCurrentTitle(updated.title);
        setCurrentNotes(updated.notes);
        setDraftTitle(updated.title);
        setDraftNotes(updated.notes);
        setIsConfirmingConvert(false);
        setFeatureAutoState("idle");
        if (next) {
          setIsEditing(false);
          resetDeleteConfirmation();
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update feature status");
      }
    });
  };

  const handleConvertPrompt = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsConfirmingConvert(true);
  };

  const handleConvertCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsConfirmingConvert(false);
  };

  const handleConvertToIdea = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    startConvertTransition(async () => {
      try {
        const result = await convertFeatureToIdeaAction({ featureId: feature.id });
        toast.success("Feature converted to idea");
        setIsConfirmingConvert(false);
        router.push(`/dashboard/ideas/${result.newIdeaId}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to convert feature");
      }
    });
  };


  const handleCardClick = () => {
    if (isEditing || isConfirmingDelete) {
      return;
    }
    setFeatureAutoState("idle");
    setIsEditing(true);
    setIsConfirmingConvert(false);
  };

  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={style}
    >
      <Card
        data-testid="feature-card"
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className={cn(
          "group border border-border/70 bg-card/80 transform-gpu transition-transform duration-200 ease-out",
          !(isEditing || isConfirmingDelete)
            ? "cursor-pointer hover:-translate-y-0.5 hover:scale-[1.006] hover:rotate-[0.18deg] hover:border-primary hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:-translate-y-0.5 focus-visible:scale-[1.004] focus-visible:rotate-[0.14deg]"
            : "",
          isDragging && "opacity-80",
          isCompleted && !isEditing && !isConfirmingDelete
            ? "border-emerald-500/40 bg-emerald-500/10 text-muted-foreground"
            : "",
        )}
      >
        <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {dragHandle ? (
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                className="shrink-0"
              >
                {dragHandle}
              </div>
            ) : null}
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle
                  className={cn(
                    "truncate text-base font-semibold",
                    isCompleted && "text-muted-foreground line-through",
                  )}
                >
                  {currentTitle}
                </CardTitle>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-700">
                    <Check className="size-3" /> Completed
                  </span>
                ) : null}
              </div>
              {!isEditing ? (
                <div
                  className="space-y-2"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <AnimatePresence initial={false} mode="wait">
                    {isExpanded ? (
                      <motion.div
                        key="expanded"
                        layout
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        {currentNotes.trim() ? (
                          <p
                            className={cn(
                              "whitespace-pre-wrap text-sm text-muted-foreground",
                              isCompleted && "line-through opacity-80",
                            )}
                          >
                            {currentNotes}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No notes yet—open to add details.</p>
                        )}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsExpanded((prev) => !prev);
                    }}
                  >
                    {isExpanded ? "Hide details" : "Show details"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div
            className="flex flex-wrap items-center justify-between gap-2 sm:gap-3"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              {completionDisplay}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                onClick={async (event) => {
                  event.stopPropagation();
                  try {
                    await navigator.clipboard.writeText(featureMarkdown);
                    toast.success("Copied feature to clipboard");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Unable to copy feature");
                  }
                }}
                aria-label="Copy feature details"
                data-testid="feature-copy-button"
              >
                <Copy className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent focus-visible:ring-0",
                  isCompleted ? "text-emerald-600" : "hover:text-emerald-600",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleCompleted();
                }}
                disabled={isCompletionPending}
                aria-label={isCompleted ? "Mark feature as in progress" : "Mark feature as completed"}
                data-testid="feature-complete-button"
              >
                {isCompleted ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-muted-foreground focus-visible:ring-0",
                  isStarred && "text-yellow-400",
                )}
                onClick={handleToggleStar}
                disabled={isStarPending}
                aria-label={isStarred ? "Unstar feature" : "Star feature"}
                data-testid="feature-star-button"
              >
                {isStarred ? <Star className="size-4 fill-current" /> : <StarOff className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="interactive-btn cursor-pointer text-muted-foreground hover:bg-transparent hover:text-destructive focus-visible:ring-0"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDelete();
                }}
                disabled={isMutating}
                aria-label="Delete feature"
                data-testid="feature-delete-button"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        {isEditing ? (
          <CardContent
            className="space-y-3"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
                  event.preventDefault();
                  event.stopPropagation();
                  handleManualSave();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelEditing();
                }
              }}
              disabled={featureAutoState === "saving"}
              data-testid="feature-edit-title-input"
              maxLength={255}
            />
            <Textarea
              value={draftNotes}
              onChange={(event) => {
                const next = event.target.value;
                if (next.length <= FEATURE_NOTES_CHARACTER_LIMIT) {
                  setDraftNotes(next);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
                  event.preventDefault();
                  event.stopPropagation();
                  handleManualSave();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelEditing();
                }
              }}
              rows={4}
              disabled={featureAutoState === "saving"}
              data-testid="feature-edit-notes-input"
              maxLength={FEATURE_NOTES_CHARACTER_LIMIT}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="interactive-btn hover:bg-transparent text-muted-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  cancelEditing();
                }}
                disabled={featureAutoState === "saving"}
                aria-label="Close editor"
              >
                <X className="size-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleManualSave();
                  }}
                  disabled={
                    featureAutoState === "saving" || !featureDirty || !trimmedDraftTitle || !trimmedDraftNotes
                  }
                  className="interactive-btn cursor-pointer"
                  data-testid="feature-save-button"
                >
                  {featureAutoState === "saving" ? "Saving…" : "Save feature"}
                </Button>
                {featureAutoState === "saving" ? (
                  <span className="text-xs text-muted-foreground">Saving…</span>
                ) : null}
                {featureAutoState === "saved" && !featureDirty ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3" /> Auto-saved
                  </span>
                ) : null}
                {featureAutoState === "error" ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <X className="size-3" /> Save failed
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              {isConfirmingConvert ? (
                <div className="flex items-center gap-2" data-testid="feature-convert-confirmation">
                  <span className="text-xs text-muted-foreground">Ya sure?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="interactive-btn"
                    onClick={handleConvertToIdea}
                    disabled={isConvertingToIdea}
                    data-testid="feature-convert-confirm"
                  >
                    {isConvertingToIdea ? "Converting…" : "Yes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="interactive-btn hover:bg-transparent"
                    onClick={handleConvertCancel}
                    disabled={isConvertingToIdea}
                    data-testid="feature-convert-cancel"
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="interactive-btn cursor-pointer hover:bg-transparent"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleConvertPrompt(event);
                  }}
                  disabled={isConvertingToIdea}
                  data-testid="feature-convert-trigger"
                >
                  Convert to idea
                </Button>
              )}
            </div>
          </CardContent>
        ) : null}
        {isConfirmingDelete ? (
          <CardContent
            className="pt-0"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <div
              className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
              data-testid="feature-delete-confirmation"
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
                    data-testid="feature-delete-input"
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
                    data-testid="feature-delete-cancel"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="interactive-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    confirmDelete();
                  }}
                  disabled={isMutating || !deleteTitleMatches}
                  data-testid="feature-delete-confirm"
                >
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </motion.div>
  );
}
