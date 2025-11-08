"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Plus, Sparkles, Star, StarOff, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { UsageMetricSummary } from "@/lib/limits/summary";
import { useLimitDialog } from "@/components/limit/limit-dialog-context";

import { createFeatureAction } from "../actions";
import type { FeatureStarState } from "@/lib/db/features";
import { IdeaCelebration } from "./IdeaCelebration";

const MAX_NOTES = 10_000;

type FeatureDraft = {
  title?: string;
  notes?: string;
  expanded?: boolean;
  starState?: FeatureStarState;
  // Deprecated: retained for backward compatibility with cached drafts prior to super-star support.
  starred?: boolean;
};

export function FeatureComposer({ ideaId, limit }: { ideaId: string; limit?: UsageMetricSummary }) {
  const router = useRouter();
  const storageKey = useMemo(() => `coda:feature-draft:${ideaId}`, [ideaId]);
  const { openLimitDialog } = useLimitDialog();

  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [starState, setStarState] = useState<FeatureStarState>("none");
  const [isPending, startTransition] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  const starLabel =
    starState === "super"
      ? "Remove super star"
      : starState === "star"
        ? "Promote to super star"
        : "Star feature";
  const celebrationTimeout = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const trimmedTitle = title.trim();
  const limitStatus = limit?.status ?? "ok";
  const isLimitBlocked = limitStatus === "blocked";
  const isLimitWarn = limitStatus === "warn";
  const limitRemaining = limit?.remaining ?? null;
  const limitCap = limit?.limit ?? null;
  const limitMessage = useMemo(() => {
    if (isLimitBlocked) {
      const capLabel = limitCap != null ? ` (${limitCap.toLocaleString()} lifetime)` : "";
      return `You’ve reached the feature limit${capLabel} for your plan. Request an override or upgrade to add more.`;
    }
    if (isLimitWarn && limitRemaining != null) {
      return `${limitRemaining.toLocaleString()} feature${limitRemaining === 1 ? "" : "s"} remaining before this idea hits the limit.`;
    }
    return null;
  }, [isLimitBlocked, isLimitWarn, limitCap, limitRemaining]);

  const hasWarnedRef = useRef(false);

  useEffect(() => {
    if (isLimitWarn && !hasWarnedRef.current) {
      hasWarnedRef.current = true;
      toast.warning(
        limitRemaining != null
          ? `${limitRemaining.toLocaleString()} feature${limitRemaining === 1 ? "" : "s"} left on this idea before you’ll need to upgrade.`
          : "You’re approaching the feature limit for this idea.",
      );
    }
    if (!isLimitWarn) {
      hasWarnedRef.current = false;
    }
  }, [isLimitWarn, limitRemaining]);

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
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(stored) as FeatureDraft;
      setTitle(parsed.title ?? "");
      setNotes(parsed.notes ?? "");
      if (parsed.starState === "star" || parsed.starState === "super" || parsed.starState === "none") {
        setStarState(parsed.starState);
      } else if (parsed.starred !== undefined) {
        setStarState(parsed.starred ? "star" : "none");
      }
      if (parsed.expanded !== undefined) {
        setIsExpanded(Boolean(parsed.expanded));
      } else if (parsed.title || parsed.notes) {
        setIsExpanded(true);
      }
    } catch (error) {
      console.warn("Unable to read feature draft from storage", error);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    const hasDraft = Boolean(title || notes);
    if (!hasDraft && !isExpanded) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    const payload: FeatureDraft = {
      title: title || undefined,
      notes: notes || undefined,
      expanded: isExpanded,
      starState: starState !== "none" ? starState : undefined,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [hydrated, isExpanded, notes, starState, storageKey, title]);

  const resetCelebration = useCallback(() => {
    if (celebrationTimeout.current && typeof window !== "undefined") {
      window.clearTimeout(celebrationTimeout.current);
    }
    celebrationTimeout.current = null;
  }, []);

  useEffect(() => () => resetCelebration(), [resetCelebration]);

  const handleSave = useCallback(() => {
    if (isLimitBlocked) {
      toast.error("You’ve reached the feature limit for this idea.");
      openLimitDialog({
        title: "Feature limit reached",
        description:
          "You’ve added the maximum number of features for this idea on your current plan. Upgrade or request an override to keep adding in the cloud.",
        secondaryCtaLabel: "Request sponsor",
        secondaryCtaHref: "/dashboard/account?tab=support",
        notes: [
          "Export the idea and continue offline for free while you regroup.",
          "Ask the idea owner to sponsor more credits or move future features to a fresh idea.",
        ],
      });
      return;
    }
    const nextTitle = title.trim();
    const nextNotes = notes.trim();
    if (!nextTitle) {
      toast.error("Name your feature before saving");
      return;
    }
    if (!nextNotes) {
      toast.error("Describe the feature before saving");
      return;
    }

    startTransition(async () => {
      try {
        await createFeatureAction({
          ideaId,
          title: nextTitle,
          notes: nextNotes,
          starred: starState !== "none",
          superStarred: starState === "super",
        });
        toast.success("Feature added");
        setTitle("");
        setNotes("");
        setStarState("none");
        setIsExpanded(false);
        setCelebrate(true);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(storageKey);
        }
        if (typeof window !== "undefined") {
          if (celebrationTimeout.current) {
            window.clearTimeout(celebrationTimeout.current);
          }
          celebrationTimeout.current = window.setTimeout(() => {
            setCelebrate(false);
            celebrationTimeout.current = null;
          }, 900);
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to add feature");
      }
    });
  }, [ideaId, isLimitBlocked, notes, openLimitDialog, router, starState, startTransition, storageKey, title]);

  const handleCancel = useCallback(() => {
    setIsExpanded(false);
    setStarState("none");
    blurActiveElement();
  }, [blurActiveElement]);

  const handleKeyCommands = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
        event.preventDefault();
        event.stopPropagation();
        handleSave();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleCancel();
        blurActiveElement();
      }
    },
    [blurActiveElement, handleCancel, handleSave],
  );

  const hasDraft = Boolean(title || notes);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handleCancel();
      blurActiveElement();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blurActiveElement, handleCancel, isExpanded]);

  useEffect(() => {
    const handleComposerClose = (event: Event) => {
      const detail = (event as CustomEvent<{ ideaId?: string }>).detail;
      if (detail?.ideaId && detail.ideaId !== ideaId) {
        return;
      }
      if (isExpanded) {
        handleCancel();
      }
    };

    window.addEventListener("coda:feature-composer:close", handleComposerClose);
    return () => window.removeEventListener("coda:feature-composer:close", handleComposerClose);
  }, [handleCancel, ideaId, isExpanded]);

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => {
          if (isLimitBlocked) {
            openLimitDialog({
              title: "Feature limit reached",
              description:
                "You’ve added the maximum features for this idea on your current plan. Upgrade or request an override to draft more features in the cloud.",
            });
            toast.error("Feature limit reached for this idea.");
            return;
          }
          setIsExpanded(true);
        }}
        className={cn(
          "group flex w-full items-center justify-between rounded-xl border-2 border-dashed border-border/60 bg-card/40 px-4 py-3 text-left transition",
          isLimitBlocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-muted hover:bg-card/60",
        )}
        data-testid="feature-launcher-open"
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Capture a new feature</span>
          <span className="text-xs text-muted-foreground">
            {isLimitBlocked
              ? "Feature limit reached—upgrade or request an override to add more."
              : hasDraft
                ? "Draft saved locally"
                : "Click to expand the feature composer"}
          </span>
        </span>
        <span className="rounded-full border border-border bg-card p-2 transition group-hover:bg-muted/70 group-hover:text-foreground">
          <Plus className="size-4" />
        </span>
      </button>
    );
  }

  return (
    <Card className="relative overflow-hidden" data-testid="feature-composer-expanded">
      <IdeaCelebration active={celebrate} />
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Add feature</CardTitle>
          <p className="text-xs text-muted-foreground">Frame the next step with a clear name and supporting context.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0",
              starState === "star" && "text-yellow-400 hover:text-yellow-300",
              starState === "super" && "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)] hover:text-amber-200",
            )}
            onClick={() => {
              const nextState: FeatureStarState =
                starState === "none" ? "star" : starState === "star" ? "super" : "none";
              setStarState(nextState);
            }}
            aria-label={starLabel}
            aria-pressed={starState !== "none"}
            data-testid="feature-star-toggle"
            data-star-state={starState}
            disabled={isPending}
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
            className="interactive-btn h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
            onClick={handleCancel}
            data-testid="feature-composer-minimize"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {limitMessage ? (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs leading-relaxed",
              isLimitBlocked
                ? "border-rose-500/50 bg-rose-500/10 text-rose-100"
                : "border-amber-400/50 bg-amber-400/10 text-amber-100",
            )}
            role="alert"
          >
            <p className="text-sm font-semibold">
              {isLimitBlocked ? "Feature limit reached" : "Heads up"}
            </p>
            <p className="pt-1 text-[0.7rem] text-inherit">{limitMessage}</p>
          </div>
        ) : null}
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={handleKeyCommands}
          placeholder="Feature name"
          maxLength={255}
          disabled={isPending || isLimitBlocked}
          data-testid="feature-title-input"
        />
        <div className="space-y-2">
          <label htmlFor="feature-notes" className="text-sm font-medium text-muted-foreground">
            {"What's next?"}
          </label>
          <Textarea
            id="feature-notes"
            value={notes}
            onChange={(event) => {
              if (event.target.value.length <= MAX_NOTES) {
                setNotes(event.target.value);
              }
            }}
            onKeyDown={handleKeyCommands}
          placeholder="Capture the short plan for this feature (max 10,000 characters)"
          maxLength={MAX_NOTES}
          rows={4}
          disabled={isPending || isLimitBlocked}
          data-testid="feature-notes-input"
        />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{notes.length}/{MAX_NOTES} characters</span>
            <span className={trimmedTitle ? "opacity-0" : ""}>Name required</span>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || isLimitBlocked}
            className="interactive-btn cursor-pointer"
            data-testid="feature-save-button"
          >
            {isPending ? "Saving…" : "Save feature"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
