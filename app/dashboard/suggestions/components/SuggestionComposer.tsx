"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_NOTES_CHARACTER_LIMIT } from "@/lib/constants/ideas";
import { createSuggestionAction } from "../actions";
import { IdeaCelebration } from "../../ideas/components/IdeaCelebration";

import { Plus, X } from "lucide-react";
import { toast } from "sonner";

type DraftStorage = {
  title?: string;
  notes?: string;
  expanded?: boolean;
};

const DRAFT_STORAGE_KEY = "coda:suggestion-draft";

type SuggestionComposerProps = {
  initialTitle?: string;
  initialNotes?: string;
  onDraftChange?: (draft: { title: string; notes: string }) => void;
  onClose?: () => void;
  onSaved?: () => void;
  showCloseButton?: boolean;
};

export function SuggestionComposerLauncher() {
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
      console.warn("Unable to read suggestion draft from storage", error);
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
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Share a suggestion</span>
          <span className="text-xs text-muted-foreground">
            {hasDraft ? "Draft saved locally" : "Click to open the suggestion composer"}
          </span>
        </span>
        <span className="rounded-full border border-border bg-card p-2 transition group-hover:bg-muted/70 group-hover:text-foreground">
          <Plus className="size-4" />
        </span>
      </button>
    );
  }

  return (
    <SuggestionComposer
      initialTitle={draft.title}
      initialNotes={draft.notes}
      onDraftChange={handleDraftChange}
      onClose={() => setIsExpanded(false)}
      onSaved={handleSaved}
      showCloseButton
    />
  );
}

export function SuggestionComposer({
  initialTitle = "",
  initialNotes = "",
  onDraftChange,
  onClose,
  onSaved,
  showCloseButton,
}: SuggestionComposerProps) {
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
        await createSuggestionAction({ title, notes });
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
        toast.success("Thanks for the suggestion!");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to capture suggestion");
      }
    });
  };

  useEffect(() => () => resetCelebration(), [resetCelebration]);

  return (
    <Card className="relative overflow-hidden border border-border/60 bg-card/85 shadow-lg">
      <IdeaCelebration active={celebrate} />
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">Suggestion box</CardTitle>
          <p className="text-sm text-muted-foreground">Let us know what would make Coda even better.</p>
        </div>
        {showCloseButton ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="interactive-btn text-muted-foreground hover:text-foreground"
            onClick={() => {
              resetCelebration();
              onClose?.();
            }}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            name="title"
            placeholder="Give your suggestion a title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isPending}
            required
          />
          <div className="space-y-2">
            <Textarea
              name="notes"
              placeholder="Describe the experience you’d love to see"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isPending}
              maxLength={IDEA_NOTES_CHARACTER_LIMIT}
              required
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{characterCount}/{IDEA_NOTES_CHARACTER_LIMIT} characters</span>
              {notesLimitExceeded ? <span className="text-destructive">Too long</span> : null}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" disabled={isPending}>
              Submit suggestion
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
