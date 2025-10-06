"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createIdeaAction } from "../actions";

export function IdeaComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await createIdeaAction({ title, notes });
        setTitle("");
        setNotes("");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create idea";
        setError(message);
      }
    });
  };

  return (
    <Card className="mb-6">
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
          <Textarea
            data-testid="idea-notes-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Capture context, constraints, next steps…"
            rows={4}
            required
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save idea"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
