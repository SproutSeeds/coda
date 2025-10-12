"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSuggestionUpdateAction } from "../actions";
import { toast } from "sonner";

export function SuggestionUpdateComposer({ suggestionId }: { suggestionId: string }) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = body.trim();
        if (!trimmed) {
          toast.error("Add a quick note before posting.");
          return;
        }
        startTransition(async () => {
          try {
            await createSuggestionUpdateAction({ suggestionId, body: trimmed });
            setBody("");
            router.refresh();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to post update");
          }
        });
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Share a quick update for the requester"
        rows={4}
        disabled={isPending}
      />
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={isPending}>
          Post update
        </Button>
      </div>
    </form>
  );
}
