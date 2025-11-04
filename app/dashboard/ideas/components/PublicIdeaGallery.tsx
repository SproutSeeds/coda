"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicIdeaSummary } from "@/lib/db/ideas";
import { cn } from "@/lib/utils";

type PublicIdeaGalleryProps = {
  ideas: PublicIdeaSummary[];
  viewerId: string | null;
};

function formatTimestamp(value: string) {
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

function getOwnerLabel(owner: PublicIdeaSummary["owner"]) {
  if (owner.name && owner.name.trim().length > 0) {
    return owner.name;
  }
  if (owner.email && owner.email.trim().length > 0) {
    return owner.email;
  }
  return owner.id;
}

export function PublicIdeaGallery({ ideas, viewerId }: PublicIdeaGalleryProps) {
  const router = useRouter();
  const viewerOwnedIds = useMemo(
    () => new Set(ideas.filter((item) => item.idea.userId === viewerId).map((item) => item.idea.id)),
    [ideas, viewerId],
  );

  if (ideas.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No public ideas yet. Once teammates publish their ideas, they&apos;ll show up here.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ideas.map(({ idea, owner }) => {
        const ownerLabel = getOwnerLabel(owner);
        const updatedLabel = formatTimestamp(idea.updatedAt ?? idea.createdAt);
        const isMine = viewerOwnedIds.has(idea.id);

        return (
          <Card
            key={idea.id}
            className="flex flex-col justify-between border-border/60 bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/60"
          >
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-foreground">{idea.title}</CardTitle>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    isMine
                      ? "border-primary/60 bg-primary/10 text-primary-foreground/90"
                      : "border-emerald-400/60 bg-emerald-500/10 text-emerald-100",
                  )}
                >
                  {isMine ? "My idea" : "Public"}
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Shared by <span className="font-semibold text-foreground">{ownerLabel}</span> • Updated {updatedLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="line-clamp-5 text-sm text-muted-foreground">
                {idea.notes && idea.notes.trim().length > 0 ? idea.notes : "No summary yet—open the idea to explore details."}
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="interactive-btn whitespace-nowrap text-xs font-semibold uppercase"
                  onClick={() => router.push(`/dashboard/ideas/${idea.id}`)}
                >
                  View idea
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
