"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createFeatureAction } from "../actions";
import { IdeaCelebration } from "./IdeaCelebration";

const MAX_NOTES = 3000;

export function FeatureComposer({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [isNaming, setIsNaming] = useState(false);
  const [featureTitle, setFeatureTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  const celebrationTimeout = useRef<number | null>(null);

  const trimmedNotes = notes.trim();
  const trimmedTitle = featureTitle.trim();

  const handleAddClick = () => {
    if (!trimmedNotes) {
      toast.error("Describe the feature before adding it");
      return;
    }
    setIsNaming(true);
  };

  const handleCancel = () => {
    setIsNaming(false);
    setFeatureTitle("");
  };

  const handleSave = () => {
    if (!trimmedTitle) {
      toast.error("Name your feature before saving");
      return;
    }
    startTransition(async () => {
      try {
        await createFeatureAction({ ideaId, title: trimmedTitle, notes: trimmedNotes });
        toast.success("Feature added");
        setNotes("");
        setFeatureTitle("");
        setIsNaming(false);
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
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to add feature");
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
    <div className="relative space-y-3" data-testid="feature-composer">
      <IdeaCelebration active={celebrate} />
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="feature-notes">
          What&apos;s Next?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Textarea
            id="feature-notes"
            value={notes}
            onChange={(event) => {
              if (event.target.value.length <= MAX_NOTES) {
                setNotes(event.target.value);
              }
            }}
            maxLength={MAX_NOTES}
            placeholder="Capture the next step or enhancement for this idea"
            rows={4}
            disabled={isPending}
            aria-label="Feature notes"
            data-testid="feature-notes-input"
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleAddClick}
            disabled={isPending}
            data-testid="feature-add-button"
            className="shrink-0"
          >
            Add feature
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-right">{notes.length}/{MAX_NOTES}</p>
      </div>
      {isNaming ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={featureTitle}
            onChange={(event) => setFeatureTitle(event.target.value)}
            placeholder="Feature name"
            disabled={isPending}
            data-testid="feature-name-input"
            aria-label="Feature name"
            className="sm:flex-1"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
              data-testid="feature-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              data-testid="feature-save-button"
            >
              {isPending ? "Saving…" : "Save feature"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
