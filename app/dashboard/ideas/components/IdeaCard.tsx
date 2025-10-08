"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState, useTransition } from "react";

import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { deleteIdeaAction, restoreIdeaAction, updateIdeaAction } from "../actions";
import { showUndoToast } from "./UndoSnackbar";
import type { Idea } from "./types";
import { cn } from "@/lib/utils";

export function IdeaCard({
  idea,
  dragHandle,
  isDragging = false,
  style,
}: {
  idea: Idea;
  dragHandle?: ReactNode;
  isDragging?: boolean;
  style?: CSSProperties;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(idea.title);
  const [notes, setNotes] = useState(idea.notes);
  const [isPending, startTransition] = useTransition();

  const handleUpdate = () => {
    startTransition(async () => {
      try {
        const updated = await updateIdeaAction({
          id: idea.id,
          title,
          notes,
          updatedAt: idea.updatedAt,
        });
        setTitle(updated.title);
        setNotes(updated.notes);
        setIsEditing(false);
        toast.success("Idea updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to update idea");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteIdeaAction({ id: idea.id });
        showUndoToast({
          message: "Idea deleted",
          onUndo: async () => {
            await restoreIdeaAction({ id: idea.id, token: result.undoToken });
            toast.success("Idea restored");
          },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete idea");
      }
    });
  };

  const createdDate = new Date(idea.createdAt).toLocaleString();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={style}
      className={cn(isDragging && "opacity-80")}
    >
      <Card data-testid="idea-card">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{idea.title}</CardTitle>
            <CardDescription>Captured {createdDate}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {dragHandle}
            <Button
              variant="secondary"
              size="sm"
              className="interactive-btn"
              onClick={() => setIsEditing((value) => !value)}
            >
              {isEditing ? "Cancel" : "Edit"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="interactive-btn"
              onClick={handleDelete}
              disabled={isPending}
            >
              Delete
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <div className="space-y-3">
              <Input
                data-testid="idea-edit-title-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Idea title"
              />
              <Textarea
                data-testid="idea-edit-notes-input"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <Button onClick={handleUpdate} disabled={isPending}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{idea.notes}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
