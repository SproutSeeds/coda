"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { purgeSuggestionAction, restoreDeletedSuggestionAction } from "../actions";
import type { Suggestion } from "./types";

export function DeletedSuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has been deleted in the last 7 days. Archived suggestions are purged automatically after a week.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {suggestions.map((suggestion) => (
        <Card key={suggestion.id} data-testid="deleted-suggestion-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">{suggestion.title}</CardTitle>
              <CardDescription>
                Deleted on {suggestion.deletedAt ? new Date(suggestion.deletedAt).toLocaleString() : "unknown"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {confirmId === suggestion.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive">Delete forever?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="interactive-btn"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await purgeSuggestionAction(suggestion.id);
                          toast.success("Suggestion permanently deleted");
                          setConfirmId(null);
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Unable to delete suggestion");
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
                          await restoreDeletedSuggestionAction(suggestion.id);
                          toast.success("Suggestion restored");
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Unable to restore suggestion");
                        }
                      });
                    }}
                    aria-label="Restore suggestion"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive transition-transform duration-150 hover:-translate-y-0.5 hover:rotate-1 hover:bg-transparent focus-visible:ring-0"
                    disabled={isPending}
                    onClick={() => setConfirmId(suggestion.id)}
                    aria-label="Delete forever"
                  >
                    <X className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className={cn("whitespace-pre-line text-sm text-muted-foreground")}>{suggestion.notes}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
