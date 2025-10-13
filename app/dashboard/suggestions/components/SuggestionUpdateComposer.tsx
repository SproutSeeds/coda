"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSuggestionUpdateAction } from "../actions";
import { toast } from "sonner";

export function SuggestionUpdateComposer({
  suggestionId,
  mode = "developer",
}: {
  suggestionId: string;
  mode?: "developer" | "submitter";
}) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const placeholder =
    mode === "developer"
      ? "Share a quick update for the requester"
      : "Add more details or ask a follow-up for the Coda team";
  const buttonLabel = mode === "developer" ? "Post update" : "Add to thread";

  const submitUpdate = () => {
    if (isPending) {
      return;
    }
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
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitUpdate();
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={isPending}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            submitUpdate();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setBody("");
            const target = event.currentTarget as HTMLTextAreaElement;
            target.blur();
          }
        }}
      />
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={isPending}>
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}
