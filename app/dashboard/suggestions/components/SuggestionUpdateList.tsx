import type { SuggestionUpdateRecord } from "@/lib/db/suggestions";

export function SuggestionUpdateList({ updates }: { updates: SuggestionUpdateRecord[] }) {
  if (updates.length === 0) {
    return <p className="text-sm text-muted-foreground">No updates yet. Developers can post progress notes here.</p>;
  }

  return (
    <ol className="space-y-4">
      {updates.map((update) => (
        <li key={update.id} className="rounded-xl border border-border/60 bg-card/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">{update.authorEmail ?? "Coda team"}</span>
            <time className="text-xs uppercase tracking-wide text-muted-foreground">
              {new Date(update.createdAt).toLocaleString()}
            </time>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{update.body}</p>
        </li>
      ))}
    </ol>
  );
}
