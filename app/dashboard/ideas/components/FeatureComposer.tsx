"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Plus, Star, StarOff, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { createFeatureAction } from "../actions";
import { IdeaCelebration } from "./IdeaCelebration";

const MAX_NOTES = 10_000;

type FeatureDraft = {
  title?: string;
  notes?: string;
  expanded?: boolean;
  starred?: boolean;
};

export function FeatureComposer({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const storageKey = useMemo(() => `coda:feature-draft:${ideaId}`, [ideaId]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [starred, setStarred] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  const celebrationTimeout = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const trimmedTitle = title.trim();
  const trimmedNotes = notes.trim();

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
      setStarred(Boolean(parsed.starred));
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
      starred,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [hydrated, isExpanded, notes, starred, storageKey, title]);

  const resetCelebration = useCallback(() => {
    if (celebrationTimeout.current && typeof window !== "undefined") {
      window.clearTimeout(celebrationTimeout.current);
    }
    celebrationTimeout.current = null;
  }, []);

  useEffect(() => () => resetCelebration(), [resetCelebration]);

  const handleSave = () => {
    if (!trimmedTitle) {
      toast.error("Name your feature before saving");
      return;
    }
    if (!trimmedNotes) {
      toast.error("Describe the feature before saving");
      return;
    }

    startTransition(async () => {
      try {
        await createFeatureAction({ ideaId, title: trimmedTitle, notes: trimmedNotes, starred });
        toast.success("Feature added");
        setTitle("");
        setNotes("");
        setStarred(false);
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
  };

  const handleCancel = useCallback(() => {
    setIsExpanded(false);
    setStarred(false);
  }, []);

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
      }
    },
    [handleCancel, handleSave],
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, isExpanded]);

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
        onClick={() => setIsExpanded(true)}
        className="group flex w-full cursor-pointer items-center justify-between rounded-xl border-2 border-dashed border-border/60 bg-card/40 px-4 py-3 text-left transition hover:border-muted hover:bg-card/60"
        data-testid="feature-launcher-open"
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Capture a new feature</span>
          <span className="text-xs text-muted-foreground">
            {hasDraft ? "Draft saved locally" : "Click to expand the feature composer"}
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
              "interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-muted-foreground focus-visible:ring-0",
              starred && "text-yellow-400",
            )}
            onClick={() => setStarred((previous) => !previous)}
            aria-label={starred ? "Remove star" : "Star feature"}
            aria-pressed={starred}
            data-testid="feature-star-toggle"
            disabled={isPending}
          >
            {starred ? <Star className="size-4 fill-current" /> : <StarOff className="size-4" />}
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
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={handleKeyCommands}
          placeholder="Feature name"
          maxLength={255}
          disabled={isPending}
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
            disabled={isPending}
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
            disabled={isPending}
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
