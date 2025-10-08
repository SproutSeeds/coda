"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { motion } from "framer-motion";
import { ArrowLeft, CalendarIcon, Clock, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_NOTES_CHARACTER_LIMIT } from "@/lib/constants/ideas";

import { deleteIdeaAction, restoreIdeaAction, updateIdeaAction } from "../actions";
import { FeatureComposer } from "./FeatureComposer";
import { FeatureList } from "./FeatureList";
import { showUndoToast } from "./UndoSnackbar";
import type { Feature, Idea } from "./types";

function formatDateTime(value: string) {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return value;
  }
}

export function IdeaDetail({ idea, features }: { idea: Idea; features: Feature[] }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(idea.title);
  const [notes, setNotes] = useState(idea.notes);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTitle(idea.title);
    setNotes(idea.notes);
  }, [idea.id, idea.title, idea.notes]);

  const createdAt = useMemo(() => formatDateTime(idea.createdAt), [idea.createdAt]);
  const updatedAt = useMemo(() => formatDateTime(idea.updatedAt), [idea.updatedAt]);
  const characterCount = notes.length;
  const notesLimitExceeded = characterCount > IDEA_NOTES_CHARACTER_LIMIT;

  const maskedId = useMemo(() => {
    if (idea.id.length <= 6) {
      return idea.id;
    }
    const visible = idea.id.slice(-6);
    return `${"*".repeat(idea.id.length - 6)}${visible}`;
  }, [idea.id]);

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(idea.id);
      toast.success("Idea ID copied");
    } catch {
      toast.error("Unable to copy ID");
    }
  }, [idea.id]);

  const handleUpdate = () => {
    if (notesLimitExceeded) {
      toast.error(`Keep the elevator pitch under ${IDEA_NOTES_CHARACTER_LIMIT} characters.`);
      return;
    }
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
        router.push("/dashboard/ideas");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete idea");
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:ring-0 transition"
          onClick={() => router.push("/dashboard/ideas")}
        >
          <ArrowLeft className="mr-2 size-4" /> Back to ideas
        </Button>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-4" /> Created {createdAt}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" /> Updated {updatedAt}
          </span>
        </div>
      </div>

      <Card data-testid="idea-card">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold">{idea.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">ID:</span>
              <span className="font-mono text-xs tracking-widest text-muted-foreground">{maskedId}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopyId}
                aria-label="Copy idea ID"
                data-testid="idea-id-copy"
              >
                <Copy className="size-4" />
              </Button>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (isEditing) {
                  setTitle(idea.title);
                  setNotes(idea.notes);
                }
                setIsEditing((value) => !value);
              }}
            >
              {isEditing ? "Cancel" : "Edit"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              Delete
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          {isEditing ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="idea-title">
                  Title
                </label>
                <Input
                  id="idea-title"
                  data-testid="idea-edit-title-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Idea title"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="idea-notes">
                    Core plan
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {characterCount}/{IDEA_NOTES_CHARACTER_LIMIT} characters
                  </span>
                </div>
                <Textarea
                  id="idea-notes"
                  data-testid="idea-edit-notes-input"
                  rows={8}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                {notesLimitExceeded ? (
                  <p className="text-xs text-destructive">
                    Keep this elevator pitch under {IDEA_NOTES_CHARACTER_LIMIT} characters.
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleUpdate} disabled={isPending}>
                  {isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Core plan</h3>
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                {notes ? (
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">{notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No core plan captured yet.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Features</h2>
            <p className="text-sm text-muted-foreground">
              Break this idea into smaller pieces and capture the details for each feature.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <FeatureComposer ideaId={idea.id} />
        </div>
        <FeatureList ideaId={idea.id} features={features} />
      </section>
    </motion.div>
  );
}
