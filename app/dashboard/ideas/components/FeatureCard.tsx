"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Star, StarOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  convertFeatureToIdeaAction,
  deleteFeatureAction,
  toggleFeatureStarAction,
  updateFeatureAction,
} from "../actions";
import type { Feature } from "./types";

const AUTOSAVE_DELAY = 1200;

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
    });
  }, [feature.id, feature.notes, feature.starred, feature.title, feature.updatedAt]);

  const trimmedDraftTitle = draftTitle.trim();
  const trimmedDraftNotes = draftNotes.trim();
  const featureDirty =
    trimmedDraftTitle !== syncedFeature.title || trimmedDraftNotes !== syncedFeature.notes;

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
  }, [syncedFeature.notes, syncedFeature.title]);

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

      if (isEditing) {
        cancelEditing();
        return;
      }

      if (isExpanded) {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelEditing, isConfirmingDelete, isEditing, isExpanded, resetDeleteConfirmation]);

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
        setCurrentTitle(updated.title);
        setCurrentNotes(updated.notes);
        setDraftTitle(updated.title);
        setDraftNotes(updated.notes);
        setSyncedFeature({
          title: updated.title,
          notes: updated.notes,
          updatedAt: updated.updatedAt,
        });
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

  const handleConfirmDelete = () => {
    if (!deleteTitleMatches) {
      toast.error("Title didn't match. Feature not deleted.");
      return;
    }

    startMutate(async () => {
      try {
        await deleteFeatureAction({ id: feature.id });
        toast.success("Feature removed");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to delete feature");
      }
    });
  };

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

  const handleConvertToIdea = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    startConvertTransition(async () => {
      try {
        const result = await convertFeatureToIdeaAction({ featureId: feature.id });
        toast.success("Feature converted to idea");
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
          "group border border-border/70 bg-card/80 transition",
          !(isEditing || isConfirmingDelete)
            ? "cursor-pointer hover:border-primary hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            : "",
          isDragging && "opacity-80",
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {dragHandle ? (
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                className="shrink-0"
              >
                {dragHandle}
              </div>
            ) : null}
            <div className="space-y-2">
              <CardTitle className="text-base font-semibold">{currentTitle}</CardTitle>
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
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{currentNotes}</p>
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
            className="flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
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
              className="interactive-btn cursor-pointer text-muted-foreground hover:bg-transparent"
              onClick={handleConvertToIdea}
              disabled={isConvertingToIdea}
              aria-label="Convert feature to idea"
              data-testid="feature-convert-to-idea"
            >
              {isConvertingToIdea ? (
                <span className="text-[10px] uppercase tracking-wide">…</span>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M12 5v10m0 0-4-4m4 4 4-4M5 19h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
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
              disabled={featureAutoState === "saving"}
              data-testid="feature-edit-title-input"
            />
            <Textarea
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              rows={4}
              disabled={featureAutoState === "saving"}
              data-testid="feature-edit-notes-input"
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
                    handleConfirmDelete();
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
