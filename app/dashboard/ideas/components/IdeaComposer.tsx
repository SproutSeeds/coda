"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_NOTES_CHARACTER_LIMIT } from "@/lib/constants/ideas";
import { createIdeaAction } from "../actions";
import { IdeaCelebration } from "./IdeaCelebration";

import { Plus, X } from "lucide-react";

const DRAFT_STORAGE_KEY = "coda:idea-draft";

type DraftStorage = {
  title?: string;
  notes?: string;
  expanded?: boolean;
};

type IdeaComposerProps = {
  initialTitle?: string;
  initialNotes?: string;
  onDraftChange?: (draft: { title: string; notes: string }) => void;
  onClose?: () => void;
  onSaved?: () => void;
  showCloseButton?: boolean;
};

export function IdeaComposerLauncher() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState<{ title: string; notes: string }>({ title: "", notes: "" });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DraftStorage;
        setDraft({ title: parsed.title ?? "", notes: parsed.notes ?? "" });
        if (parsed.expanded !== undefined) {
          setIsExpanded(Boolean(parsed.expanded));
        } else if (parsed.title || parsed.notes) {
          setIsExpanded(true);
        }
      }
    } catch (error) {
      console.warn("Unable to read idea draft from storage", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const hasDraft = Boolean(draft.title || draft.notes);
    if (!hasDraft && !isExpanded) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    const payload: DraftStorage = {
      title: draft.title || undefined,
      notes: draft.notes || undefined,
      expanded: isExpanded,
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [draft, hydrated, isExpanded]);

  const handleDraftChange = useCallback((nextDraft: { title: string; notes: string }) => {
    setDraft(nextDraft);
  }, []);

  const handleSaved = useCallback(() => {
    setDraft({ title: "", notes: "" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    setIsExpanded(false);
  }, []);

  const hasDraft = Boolean(draft.title || draft.notes);

  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      setIsExpanded(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="group flex w-full cursor-pointer items-center justify-between rounded-xl border-2 border-dashed border-border/60 bg-card/40 px-4 py-3 text-left transition hover:border-primary hover:bg-card"
        data-testid="idea-launcher-open"
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Capture a new idea</span>
          <span className="text-xs text-muted-foreground">
            {hasDraft ? "Draft saved locally" : "Click to expand the full composer"}
          </span>
        </span>
        <span className="rounded-full border border-border bg-card p-2 transition group-hover:bg-muted/70 group-hover:text-foreground">
          <Plus className="size-4" />
        </span>
      </button>
    );
  }

  return (
    <IdeaComposer
      initialTitle={draft.title}
      initialNotes={draft.notes}
      onDraftChange={handleDraftChange}
      onClose={() => setIsExpanded(false)}
      onSaved={handleSaved}
      showCloseButton
    />
  );
}

export function IdeaComposer({
  initialTitle = "",
  initialNotes = "",
  onDraftChange,
  onClose,
  onSaved,
  showCloseButton,
}: IdeaComposerProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  const celebrationTimeout = useRef<number | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    onDraftChange?.({ title, notes });
  }, [title, notes, onDraftChange]);

  const characterCount = notes.length;
  const notesLimitExceeded = characterCount > IDEA_NOTES_CHARACTER_LIMIT;

  const resetCelebration = useCallback(() => {
    if (celebrationTimeout.current && typeof window !== "undefined") {
      window.clearTimeout(celebrationTimeout.current);
    }
    celebrationTimeout.current = null;
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (notesLimitExceeded) {
      setError(`Keep the elevator pitch under ${IDEA_NOTES_CHARACTER_LIMIT} characters.`);
      return;
    }

    startTransition(async () => {
      try {
        await createIdeaAction({ title, notes });
        setTitle("");
        setNotes("");
        onDraftChange?.({ title: "", notes: "" });
        router.refresh();
        setCelebrate(true);
        if (typeof window !== "undefined") {
          if (celebrationTimeout.current) {
            window.clearTimeout(celebrationTimeout.current);
          }
          celebrationTimeout.current = window.setTimeout(() => {
            setCelebrate(false);
            celebrationTimeout.current = null;
          }, 900);
        }
        onSaved?.();
        onClose?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create idea";
        setError(message);
      }
    });
  };

  useEffect(() => () => resetCelebration(), [resetCelebration]);

  return (
    <Card className="relative mb-2 overflow-hidden" data-testid="idea-composer-expanded">
      <IdeaCelebration active={celebrate} />
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-2">
        <CardTitle className="text-[1.4rem]">Add idea</CardTitle>
        {showCloseButton ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="interactive-btn h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
        onClick={onClose}
        data-testid="idea-composer-minimize"
      >
        <X className="size-4" />
      </Button>
        ) : null}
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-1.5 pt-0 pb-2">
          <Input
            data-testid="idea-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Idea title"
            maxLength={255}
            required
          />
          <div className="space-y-1">
            <label htmlFor="idea-composer-notes" className="text-sm font-medium text-muted-foreground">
              Core plan
            </label>
            <Textarea
              id="idea-composer-notes"
              data-testid="idea-notes-input"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Summarize the core plan in 10,000 characters or fewer"
              maxLength={IDEA_NOTES_CHARACTER_LIMIT}
              rows={3}
              required
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{characterCount}/{IDEA_NOTES_CHARACTER_LIMIT} characters</span>
              {notesLimitExceeded ? (
                <span className="text-destructive">Too long for an elevator pitch.</span>
              ) : null}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end pt-0">
            <Button
              type="submit"
              disabled={isPending}
              className="interactive-btn cursor-pointer"
            >
              {isPending ? "Saving…" : "Save idea"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
