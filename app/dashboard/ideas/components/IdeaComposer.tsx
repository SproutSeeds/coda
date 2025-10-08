"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_NOTES_CHARACTER_LIMIT } from "@/lib/constants/ideas";
import { createIdeaAction } from "../actions";
import { IdeaCelebration } from "./IdeaCelebration";

export function IdeaComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  const celebrationTimeout = useRef<number | null>(null);

  const characterCount = notes.length;
  const notesLimitExceeded = characterCount > IDEA_NOTES_CHARACTER_LIMIT;

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
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create idea";
        setError(message);
      }
    });
  };

  useEffect(() => {
    return () => {
      if (celebrationTimeout.current && typeof window !== "undefined") {
        window.clearTimeout(celebrationTimeout.current);
      }
    };
  }, []);

  return (
    <Card className="relative mb-6 overflow-hidden">
      <IdeaCelebration active={celebrate} />
      <CardHeader>
        <CardTitle>Add idea</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          <Input
            data-testid="idea-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Idea title"
            maxLength={200}
            required
          />
          <div className="space-y-2">
            <label htmlFor="idea-composer-notes" className="text-sm font-medium text-muted-foreground">
              Core plan
            </label>
            <Textarea
              id="idea-composer-notes"
              data-testid="idea-notes-input"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Summarize the core plan in 1000 characters or fewer"
              rows={4}
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
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isPending}
              className="interactive-btn hover:bg-primary focus-visible:ring-0"
            >
              {isPending ? "Saving…" : "Save idea"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
