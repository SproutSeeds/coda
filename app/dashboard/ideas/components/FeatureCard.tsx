"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, ChevronDown, ChevronUp, Circle, Copy, MoreHorizontal, Plus, Star, StarOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const FEATURE_NOTES_CHARACTER_LIMIT = 10_000;
const FEATURE_DETAIL_CHARACTER_LIMIT = 10_000;
const FEATURE_DETAIL_LABEL_LIMIT = 60;

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
const FEATURE_DETAIL_SECTION_LIMIT = 25;

type DetailSectionState = {
  id?: string;
  label: string;
  body: string;
};

function normalizeDetailSectionsState(sections: Feature["detailSections"]): DetailSectionState[] {
  return sections.map((section) => ({
    id: section.id,
    label: section.label || "Detail",
    body: section.body || "",
  }));
}

function collapseDetailState(details: DetailSectionState[]): DetailSectionState[] {
  return details
    .map((section) => ({
      id: section.id,
      label: section.label.trim(),
      body: section.body.trim(),
    }))
    .filter((section) => section.body.length > 0 || section.label.length > 0);
}

function detailStatesEqual(a: DetailSectionState[], b: DetailSectionState[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index]!;
    const right = b[index]!;
    if (left.label !== right.label || left.body !== right.body) {
      return false;
    }
  }
  return true;
}

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
  const [draftDetails, setDraftDetails] = useState<DetailSectionState[]>(normalizeDetailSectionsState(feature.detailSections));
  const [currentDetails, setCurrentDetails] = useState<DetailSectionState[]>(normalizeDetailSectionsState(feature.detailSections));
  const [syncedFeature, setSyncedFeature] = useState({
    title: feature.title,
    notes: feature.notes,
    detailSections: normalizeDetailSectionsState(feature.detailSections),
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
  const [isDetailEditorVisible, setIsDetailEditorVisible] = useState(
    normalizeDetailSectionsState(feature.detailSections).length > 0,
  );
  const [confirmingDetailRemovalIndex, setConfirmingDetailRemovalIndex] = useState<number | null>(null);
  const hasRenderedDetail = useMemo(
    () => currentDetails.some((section) => section.body.trim()),
    [currentDetails],
  );
  const hasNotes = useMemo(() => Boolean(currentNotes.trim()), [currentNotes]);
  const detailPreviewLabels = useMemo(() => {
    if (!hasRenderedDetail) return [] as string[];
    const labels = currentDetails
      .filter((section) => (section.label || "").trim().length > 0)
      .map((section) => (section.label || "Detail").trim());
    if (labels.length === 0) {
      labels.push("Detail");
    }
    return labels.slice(0, 4);
  }, [currentDetails, hasRenderedDetail]);
  const featureMarkdown = useMemo(() => {
    const normalizedTitle = currentTitle?.trim?.() || feature.title;
    const normalizedNotes = currentNotes?.trim?.() ?? "";
    const header = `## Feature: ${normalizedTitle}`;
    const body = normalizedNotes ? normalizedNotes : "_No notes yet._";
    const detailSection =
      isExpanded && hasRenderedDetail
        ? `\n\n${currentDetails
            .filter((section) => section.body.trim())
            .map((section) => `**${(section.label || "Detail").trim() || "Detail"}**\n\n${section.body.trim()}`)
            .join("\n\n---\n\n")}`
        : "";
    return `${header}\n\n${body}${detailSection}`.trim();
  }, [currentDetails, currentNotes, currentTitle, feature.title, hasRenderedDetail, isExpanded]);
  const featureDetailMarkdown = useMemo(() => {
    const sections = currentDetails.filter((section) => section.body.trim());
    if (sections.length === 0) return "";
    return sections
      .map((section) => `**${(section.label || "Detail").trim() || "Detail"}**\n\n${section.body.trim()}`)
      .join("\n\n---\n\n")
      .trim();
  }, [currentDetails]);

  useEffect(() => {
    const normalizedDetails = normalizeDetailSectionsState(feature.detailSections);
    const currentClone = normalizedDetails.map((section) => ({ ...section }));
    const draftClone = normalizedDetails.map((section) => ({ ...section }));
    setCurrentTitle(feature.title);
    setCurrentNotes(feature.notes);
    setCurrentDetails(currentClone);
    setDraftTitle(feature.title);
    setDraftNotes(feature.notes);
    setDraftDetails(draftClone);
    setIsStarred(feature.starred);
    setSyncedFeature({
      title: feature.title,
      notes: feature.notes,
      detailSections: normalizedDetails.map((section) => ({ ...section })),
      updatedAt: feature.updatedAt,
      completed: feature.completed,
      completedAt: feature.completedAt,
    });
    setIsCompleted(Boolean(feature.completed));
    setCompletedAt(feature.completedAt ?? null);
    setIsDetailEditorVisible(normalizedDetails.length > 0);
    setConfirmingDetailRemovalIndex(null);
  }, [
    feature.completed,
    feature.completedAt,
    feature.detailSections,
    feature.id,
    feature.notes,
    feature.starred,
    feature.title,
    feature.updatedAt,
  ]);

  const trimmedDraftTitle = draftTitle.trim();
  const trimmedDraftNotes = draftNotes.trim();
  const collapsedDraftDetails = useMemo(() => collapseDetailState(draftDetails), [draftDetails]);
  const collapsedSyncedDetails = useMemo(
    () => collapseDetailState(syncedFeature.detailSections),
    [syncedFeature.detailSections],
  );
  const featureDirty =
    trimmedDraftTitle !== syncedFeature.title ||
    trimmedDraftNotes !== syncedFeature.notes ||
    !detailStatesEqual(collapsedDraftDetails, collapsedSyncedDetails);
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
    setDraftDetails(syncedFeature.detailSections.map((section) => ({ ...section })));
    setIsDetailEditorVisible(syncedFeature.detailSections.length > 0);
    setIsEditing(false);
    setFeatureAutoState("idle");
    setIsConfirmingConvert(false);
  }, [syncedFeature.detailSections, syncedFeature.notes, syncedFeature.title, setIsConfirmingConvert]);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      let handled = false;

      if (isConfirmingDelete) {
        resetDeleteConfirmation();
        handled = true;
      } else if (isConfirmingConvert) {
        setIsConfirmingConvert(false);
        handled = true;
      } else if (isEditing) {
        cancelEditing();
        handled = true;
      } else if (isExpanded) {
        setIsExpanded(false);
        handled = true;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        blurActiveElement();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blurActiveElement, cancelEditing, isConfirmingConvert, isConfirmingDelete, isEditing, isExpanded, resetDeleteConfirmation, setIsConfirmingConvert]);

  const saveFeature = useCallback(
    async (titleValue: string, notesValue: string, detailSectionsValue: DetailSectionState[]) => {
      featureSaveInFlight.current = true;
      try {
        const collapsedDetails = collapseDetailState(detailSectionsValue);
        const updated = await updateFeatureAction({
          id: feature.id,
          ideaId,
          title: titleValue,
          notes: notesValue,
          details: collapsedDetails.map((section) => ({
            id: section.id,
            label: section.label || "Detail",
            body: section.body,
          })),
        });
        const normalizedDetails = normalizeDetailSectionsState(updated.detailSections);
        setCurrentTitle(updated.title);
        setCurrentNotes(updated.notes);
        setCurrentDetails(normalizedDetails.map((section) => ({ ...section })));
        setDraftTitle(updated.title);
        setDraftNotes(updated.notes);
        setDraftDetails(normalizedDetails.map((section) => ({ ...section })));
        setSyncedFeature({
          title: updated.title,
          notes: updated.notes,
          detailSections: normalizedDetails.map((section) => ({ ...section })),
          updatedAt: updated.updatedAt,
          completed: updated.completed,
          completedAt: updated.completedAt,
        });
        setIsCompleted(Boolean(updated.completed));
        setCompletedAt(updated.completedAt ?? null);
        setIsDetailEditorVisible(normalizedDetails.length > 0);
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
      void saveFeature(trimmedDraftTitle, trimmedDraftNotes, draftDetails)
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
  }, [featureAutoState, featureDirty, isEditing, saveFeature, trimmedDraftNotes, trimmedDraftTitle, draftDetails]);

  const handleManualSave = () => {
    if (!trimmedDraftTitle || !trimmedDraftNotes) {
      toast.error("Provide a title and notes to save");
      return;
    }
    setFeatureAutoState("saving");
    void saveFeature(trimmedDraftTitle, trimmedDraftNotes, draftDetails)
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
  }, [deleteTitleMatches, feature.id, isMutating, resetDeleteConfirmation, router, startMutate]);

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
        const normalizedDetails = normalizeDetailSectionsState(updated.detailSections);
        setSyncedFeature({
          title: updated.title,
          notes: updated.notes,
          detailSections: normalizedDetails.map((section) => ({ ...section })),
          updatedAt: updated.updatedAt,
          completed: updated.completed,
          completedAt: updated.completedAt,
        });
        setCurrentTitle(updated.title);
        setCurrentNotes(updated.notes);
        setCurrentDetails(normalizedDetails.map((section) => ({ ...section })));
        setDraftTitle(updated.title);
        setDraftNotes(updated.notes);
        setDraftDetails(normalizedDetails.map((section) => ({ ...section })));
        setIsDetailEditorVisible(normalizedDetails.length > 0);
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

const addDetailSection = useCallback(() => {
  setDraftDetails((previous) => {
    if (previous.length >= FEATURE_DETAIL_SECTION_LIMIT) {
      toast.error(`You can add up to ${FEATURE_DETAIL_SECTION_LIMIT} detail sections.`);
      return previous;
    }
    return [...previous, { id: undefined, label: "", body: "" }];
  });
  setIsDetailEditorVisible(true);
  setConfirmingDetailRemovalIndex(null);
}, []);

const updateDetailSection = useCallback((index: number, value: Partial<DetailSectionState>) => {
  setDraftDetails((previous) => {
    const next = [...previous];
    next[index] = { ...next[index], ...value };
    return next;
  });
}, []);

const requestRemoveDetailSection = useCallback((index: number) => {
  setConfirmingDetailRemovalIndex(index);
}, []);

const confirmRemoveDetailSection = useCallback(() => {
  setDraftDetails((previous) => {
    if (confirmingDetailRemovalIndex == null) {
      return previous;
    }
    const next = previous.filter((_, position) => position !== confirmingDetailRemovalIndex);
    if (next.length === 0) {
      setIsDetailEditorVisible(false);
    }
    return next;
  });
  setConfirmingDetailRemovalIndex(null);
}, [confirmingDetailRemovalIndex]);

const cancelRemoveDetailSection = useCallback(() => {
  setConfirmingDetailRemovalIndex(null);
}, []);

const moveDetailSection = useCallback((index: number, direction: -1 | 1) => {
  setDraftDetails((previous) => {
    const target = index + direction;
    if (target < 0 || target >= previous.length) {
        return previous;
      }
    const next = [...previous];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    return next;
  });
  setConfirmingDetailRemovalIndex(null);
}, []);


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
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    return;
                  }
                  event.stopPropagation();
                }}
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
                  className="space-y-3"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      return;
                    }
                    event.stopPropagation();
                  }}
                >
                  {hasRenderedDetail ? (
                    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2" data-testid="feature-detail-summary">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {detailPreviewLabels.map((label, index) => (
                            <span
                              key={`${label}-${index}`}
                              className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {label}
                            </span>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="interactive-btn h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                            onClick={async (event) => {
                              event.stopPropagation();
                              if (!featureDetailMarkdown) return;
                              try {
                                await navigator.clipboard.writeText(featureDetailMarkdown);
                                toast.success("Copied detail to clipboard");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Unable to copy detail");
                              }
                            }}
                            aria-label="Copy detail"
                            data-testid="feature-detail-copy-button"
                            disabled={!featureDetailMarkdown}
                          >
                            <Copy className="size-4" />
                          </Button>
                        </div>
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold tracking-wide text-primary underline-offset-4 transition hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsExpanded((prev) => !prev);
                          }}
                          onKeyDown={(event) => {
                          if (event.key !== "Escape") {
                            return;
                          }
                          if (isExpanded) {
                            event.preventDefault();
                            event.stopPropagation();
                            setIsExpanded(false);
                            blurActiveElement();
                          }
                        }}
                      >
                          {isExpanded ? (
                            <>
                              <X className="size-3" /> Hide details
                            </>
                          ) : (
                            <>
                              <MoreHorizontal className="size-3" /> More detail
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <AnimatePresence initial={false} mode="wait">
                    {isExpanded ? (
                      <motion.div
                        key="expanded"
                        layout
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="space-y-3 rounded-lg border border-border/60 bg-card/70 px-4 py-3"
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            setIsExpanded(false);
                            blurActiveElement();
                          }
                        }}
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
                        {hasRenderedDetail ? (
                          <div className="space-y-2">
                            {currentDetails
                              .filter((section) => section.body.trim())
                              .map((section, index) => {
                                const sectionLabel = (section.label || "Detail").trim() || "Detail";
                                const sectionMarkdown = `**${sectionLabel}**\n\n${section.body.trim()}`;
                                return (
                                  <div
                                    key={`feature-${feature.id}-detail-expanded-${index}`}
                                    className="space-y-2 rounded-md border border-border/50 bg-background/70 px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                                        {sectionLabel}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="interactive-btn h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                                        onClick={async (event) => {
                                          event.stopPropagation();
                                          try {
                                            await navigator.clipboard.writeText(sectionMarkdown);
                                            toast.success("Copied detail to clipboard");
                                          } catch (err) {
                                            toast.error(err instanceof Error ? err.message : "Unable to copy detail");
                                          }
                                        }}
                                        aria-label="Copy detail section"
                                        data-testid={`feature-detail-copy-button-expanded-${index}`}
                                      >
                                        <Copy className="size-4" />
                                      </Button>
                                    </div>
                                    <p
                                      className={cn(
                                        "whitespace-pre-wrap text-sm text-muted-foreground",
                                        isCompleted && "line-through opacity-80",
                                      )}
                                    >
                                      {section.body}
                                    </p>
                                  </div>
                                );
                              })}
                          </div>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  {!hasRenderedDetail && hasNotes ? (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsExpanded((prev) => !prev);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Escape") {
                          return;
                        }
                        if (isExpanded) {
                          event.preventDefault();
                          event.stopPropagation();
                          setIsExpanded(false);
                          blurActiveElement();
                        }
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <X className="size-3" /> Hide details
                        </>
                      ) : (
                        <>
                          <MoreHorizontal className="size-3" /> Show details
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div
            className="flex flex-wrap items-center justify-between gap-2 sm:gap-3"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                return;
              }
              event.stopPropagation();
            }}
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
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                return;
              }
              event.stopPropagation();
            }}
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
                      blurActiveElement();
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
                  blurActiveElement();
                }
              }}
              rows={4}
              disabled={featureAutoState === "saving"}
              data-testid="feature-edit-notes-input"
              maxLength={FEATURE_NOTES_CHARACTER_LIMIT}
            />
            {isDetailEditorVisible ? (
              <div className="rounded-xl border-2 border-dashed border-border/60 bg-card/40 p-3" data-testid="feature-detail-editor">
                <div className="space-y-4">
                  {draftDetails.length > 0 ? (
                    draftDetails.map((detail, index) => {
                      const labelInputId = `feature-${feature.id}-detail-label-${index}`;
                      const bodyInputId = `feature-${feature.id}-detail-body-${index}`;
                      return (
                        <div key={labelInputId} className="rounded-lg border border-border/60 bg-background/60 p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <Label
                                htmlFor={labelInputId}
                                className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                              >
                                Detail label
                              </Label>
                              <Input
                                id={labelInputId}
                                value={detail.label}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next.length <= FEATURE_DETAIL_LABEL_LIMIT) {
                                    updateDetailSection(index, { label: next });
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && !(event.nativeEvent as KeyboardEvent).isComposing) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleManualSave();
                                    return;
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    cancelEditing();
                                    blurActiveElement();
                                  }
                                }}
                                maxLength={FEATURE_DETAIL_LABEL_LIMIT}
                                disabled={featureAutoState === "saving"}
                                placeholder="Detail heading"
                                data-testid={`feature-edit-detail-label-input-${index}`}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex items-center gap-1 pt-6">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="interactive-btn text-muted-foreground hover:bg-transparent"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  moveDetailSection(index, -1);
                                }}
                                disabled={featureAutoState === "saving" || index === 0}
                                aria-label="Move detail up"
                              >
                                <ChevronUp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="interactive-btn text-muted-foreground hover:bg-transparent"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  moveDetailSection(index, 1);
                                }}
                                disabled={featureAutoState === "saving" || index === draftDetails.length - 1}
                                aria-label="Move detail down"
                              >
                                <ChevronDown className="size-4" />
                              </Button>
                              {confirmingDetailRemovalIndex === index ? (
                                <div className="flex items-center gap-1" data-testid={`feature-detail-remove-confirm-${index}`}>
                                  <span className="text-xs text-muted-foreground">Ya sure?</span>
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="destructive"
                                    className="interactive-btn"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      confirmRemoveDetailSection();
                                    }}
                                    disabled={featureAutoState === "saving"}
                                    aria-label="Confirm remove detail section"
                                  >
                                    <Check className="size-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="outline"
                                    className="interactive-btn hover:bg-transparent"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      cancelRemoveDetailSection();
                                    }}
                                    disabled={featureAutoState === "saving"}
                                    aria-label="Cancel remove detail section"
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="interactive-btn text-destructive hover:bg-transparent"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    requestRemoveDetailSection(index);
                                  }}
                                  disabled={featureAutoState === "saving"}
                                  aria-label="Remove detail section"
                                  data-testid={`feature-detail-remove-${index}`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <Textarea
                            id={bodyInputId}
                            value={detail.body}
                            onChange={(event) => {
                              const next = event.target.value;
                              if (next.length <= FEATURE_DETAIL_CHARACTER_LIMIT) {
                                updateDetailSection(index, { body: next });
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
                                blurActiveElement();
                              }
                            }}
                            rows={3}
                            disabled={featureAutoState === "saving"}
                            placeholder="Add detail body"
                            data-testid={`feature-edit-detail-input-${index}`}
                            maxLength={FEATURE_DETAIL_CHARACTER_LIMIT}
                            className="mt-3"
                          />
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground">No detail sections yet. Add one below.</p>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="interactive-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      addDetailSection();
                    }}
                    disabled={featureAutoState === "saving" || draftDetails.length >= FEATURE_DETAIL_SECTION_LIMIT}
                    data-testid="feature-detail-add-button"
                  >
                    <Plus className="mr-2 size-4" /> Add detail section
                  </Button>
                  {draftDetails.length === 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="interactive-btn text-muted-foreground hover:bg-transparent"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsDetailEditorVisible(false);
                      }}
                      disabled={featureAutoState === "saving"}
                      aria-label="Close detail editor"
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (draftDetails.length === 0) {
                    addDetailSection();
                  } else {
                    setIsDetailEditorVisible(true);
                  }
                }}
                className="group flex w-full cursor-pointer items-center justify-between rounded-xl border-2 border-dashed border-border/60 bg-card/40 px-4 py-3 text-left transition hover:border-muted hover:bg-card/60"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">Add a detail section</span>
                  <span className="text-xs text-muted-foreground">Store quick snippets, links, or extra context.</span>
                </span>
                <span className="rounded-full border border-border bg-card p-2 transition group-hover:bg-muted/70 group-hover:text-foreground">
                  <Plus className="size-4" />
                </span>
              </button>
            )}
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
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                return;
              }
              event.stopPropagation();
            }}
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
