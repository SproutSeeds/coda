"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { purgeDeletedIdeaAction, restoreDeletedIdeaAction } from "../actions";
import type { Idea } from "./types";

export function DeletedIdeaList({ ideas }: { ideas: Idea[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (ideas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has been deleted in the last 7 days. Removed ideas are purged automatically after a week.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {ideas.map((idea) => (
        <Card key={idea.id} data-testid="deleted-idea-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">{idea.title}</CardTitle>
              <CardDescription>
                Deleted on {idea.deletedAt ? new Date(idea.deletedAt).toLocaleString() : "unknown"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {confirmId === idea.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive">Ya sure?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="interactive-btn"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await purgeDeletedIdeaAction(idea.id);
                          toast.success("Idea permanently deleted");
                          setConfirmId(null);
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Unable to delete idea");
                        }
                      });
                    }}
                  >
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="interactive-btn hover:bg-transparent focus-visible:ring-0"
                    disabled={isPending}
                    onClick={() => setConfirmId(null)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="transition-transform duration-150 hover:-translate-y-0.5 hover:rotate-1 hover:bg-transparent focus-visible:ring-0"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await restoreDeletedIdeaAction(idea.id);
                          toast.success("Idea restored");
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Unable to restore idea");
                        }
                      });
                    }}
                    aria-label="Restore idea"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive transition-transform duration-150 hover:-translate-y-0.5 hover:rotate-1 hover:bg-transparent focus-visible:ring-0"
                    disabled={isPending}
                    onClick={() => setConfirmId(idea.id)}
                    aria-label="Delete forever"
                  >
                    <X className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className={cn("whitespace-pre-line text-sm text-muted-foreground")}>{idea.notes}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
