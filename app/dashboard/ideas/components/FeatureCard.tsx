"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { deleteFeatureAction, updateFeatureAction } from "../actions";
import type { Feature } from "./types";

export function FeatureCard({ feature, ideaId }: { feature: Feature; ideaId: string }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [draftTitle, setDraftTitle] = useState(feature.title);
  const [draftNotes, setDraftNotes] = useState(feature.notes);
  const [currentTitle, setCurrentTitle] = useState(feature.title);
  const [currentNotes, setCurrentNotes] = useState(feature.notes);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentTitle(feature.title);
    setCurrentNotes(feature.notes);
    setDraftTitle(feature.title);
    setDraftNotes(feature.notes);
  }, [feature.id, feature.title, feature.notes]);

  const handleUpdate = () => {
    const titleValue = draftTitle.trim();
    const notesValue = draftNotes.trim();
    if (!titleValue || !notesValue) {
      toast.error("Provide a title and notes to save");
      return;
    }

    startTransition(async () => {
      try {
        await updateFeatureAction({ id: feature.id, ideaId, title: titleValue, notes: notesValue });
        toast.success("Feature updated");
        setCurrentTitle(titleValue);
        setCurrentNotes(notesValue);
        setDraftTitle(titleValue);
        setDraftNotes(notesValue);
        setIsEditing(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update feature");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteFeatureAction({ id: feature.id });
        toast.success("Feature removed");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to delete feature");
      }
    });
  };

  const renderNotes = () => {
    if (!currentNotes.trim()) {
      return <p className="text-sm text-muted-foreground">No notes yet.</p>;
    }

    if (!isExpanded) {
      const preview = currentNotes.length > 160 ? `${currentNotes.slice(0, 157).trimEnd()}…` : currentNotes;
      return <p className="text-sm text-muted-foreground">{preview}</p>;
    }

    return <p className="whitespace-pre-wrap text-sm text-muted-foreground">{currentNotes}</p>;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Card data-testid="feature-card" className="border border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-base font-semibold">{currentTitle}</CardTitle>
            {!isEditing ? renderNotes() : null}
            <button
              type="button"
              className="inline-flex items-center text-xs font-medium text-primary underline-offset-4 transition hover:underline"
              onClick={() => setIsExpanded((prev) => !prev)}
            >
              {isExpanded ? "Hide details" : "More details"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing((prev) => !prev)}
              data-testid="feature-edit-toggle"
            >
              {isEditing ? "Cancel" : "Edit"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isPending}
              data-testid="feature-delete-button"
            >
              Delete
            </Button>
          </div>
        </CardHeader>
        {isEditing ? (
          <CardContent className="space-y-3">
            <Input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              disabled={isPending}
              data-testid="feature-edit-title-input"
            />
            <Textarea
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              rows={4}
              disabled={isPending}
              data-testid="feature-edit-notes-input"
            />
            <div className="flex justify-end">
              <Button onClick={handleUpdate} disabled={isPending} data-testid="feature-save-button">
                {isPending ? "Saving…" : "Save feature"}
              </Button>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </motion.div>
  );
}
