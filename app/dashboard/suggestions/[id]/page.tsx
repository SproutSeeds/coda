import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { loadSuggestionDetailAction, setSuggestionCompletionAction } from "../actions";
import { SuggestionUpdateList } from "../components/SuggestionUpdateList";
import { SuggestionUpdateComposer } from "../components/SuggestionUpdateComposer";

export default async function SuggestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const detail = await loadSuggestionDetailAction(id).catch((error) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[suggestions] loadSuggestionDetailAction failed", {
        suggestionId: id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  });
  if (!detail) {
    notFound();
  }

  const { suggestion, updates, isDeveloper } = detail;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">{suggestion.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Submitted by {suggestion.submittedEmail ?? "anonymous"}</span>
            <span>•</span>
            <span>Created {new Date(suggestion.createdAt).toLocaleString()}</span>
            {suggestion.completed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">
                Completed {suggestion.completedAt ? new Date(suggestion.completedAt).toLocaleString() : "recently"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                In progress
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDeveloper ? (
            <form action={async () => {
              "use server";
              await setSuggestionCompletionAction({ id: suggestion.id, completed: !suggestion.completed });
            }}>
              <button
                type="submit"
                className="interactive-btn rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {suggestion.completed ? "Reopen" : "Mark completed"}
              </button>
            </form>
          ) : null}
          <Link
            href="/dashboard/suggestions"
            className="interactive-btn rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Original feedback</h2>
        <p className="whitespace-pre-line text-sm text-foreground">{suggestion.notes}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Updates</h2>
          {isDeveloper ? (
            <span className="text-xs text-muted-foreground">Visible to the requester immediately</span>
          ) : null}
        </div>
        <SuggestionUpdateList updates={updates} />
        {isDeveloper ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
            <h3 className="text-sm font-semibold text-foreground">Post an update</h3>
            <p className="text-xs text-muted-foreground">Share progress, status changes, or planned timelines.</p>
            <div className="mt-4">
              <SuggestionUpdateComposer suggestionId={suggestion.id} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
