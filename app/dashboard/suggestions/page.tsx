import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { DEVELOPER_EMAIL } from "@/lib/constants";
import { SuggestionComposerLauncher } from "./components/SuggestionComposer";
import { SuggestionBoard } from "./components/SuggestionBoard";
import { LoadMore } from "../ideas/components/LoadMore";
import { loadDeletedSuggestionsAction, loadMySuggestionsAction, loadSuggestions } from "./actions";
import { SuggestionCard } from "./components/SuggestionCard";
import type { SuggestionSort } from "@/lib/db/suggestions";

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string; sort?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const isDeveloper = user.email?.toLowerCase() === DEVELOPER_EMAIL.toLowerCase();

  if (!isDeveloper) {
    const mySuggestions = await loadMySuggestionsAction();
    const active = mySuggestions.filter((item) => !item.completed);
    const completed = mySuggestions.filter((item) => item.completed);
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Suggestion box</h1>
          <p className="text-sm text-muted-foreground">
            Share feedback that the Coda team will review privately.
          </p>
        </div>
        <SuggestionComposerLauncher />
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Your submissions</h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Suggestions you share will appear here with updates from the Coda team.
            </p>
          ) : (
            <div className="space-y-3">
              {active.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} mode="submitter" />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Completed</h2>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Completed suggestions will move here once the team is done.</p>
          ) : (
            <div className="space-y-3">
              {completed.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} mode="submitter" />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  const allowedSorts = ["priority", "created_desc", "updated_desc", "title_asc"] as const;
  const sortParam: SuggestionSort = params.sort && allowedSorts.includes(params.sort as typeof allowedSorts[number])
    ? (params.sort as SuggestionSort)
    : "priority";
  const [data, deleted] = await Promise.all([
    loadSuggestions({ q: params.q, cursor: params.cursor, sort: sortParam }),
    loadDeletedSuggestionsAction(),
  ]);

  return (
    <section className="space-y-6">
      <SuggestionComposerLauncher />
      <SuggestionBoard
        suggestions={data.items}
        deleted={deleted}
        query={params.q}
        sort={sortParam}
      />
      {data.nextCursor ? <LoadMore cursor={data.nextCursor} /> : null}
    </section>
  );
}
