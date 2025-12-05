import type { IdeaSort } from "@/lib/db/ideas";
import { requireUser } from "@/lib/auth/session";
import { trackJourneyAction } from "@/lib/journey/tracker";

import { loadDeletedIdeas, loadIdeas } from "./actions";
import { IdeaComposerLauncher } from "./components/IdeaComposer";
import { IdeaBoard } from "./components/IdeaBoard";
import { LoadMore } from "./components/LoadMore";
import { IdeasContentWrapper } from "./components/IdeasContentWrapper";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string; sort?: string; show?: string }>;
}) {
  const params = await searchParams;
  const allowedSorts: IdeaSort[] = ["priority", "created_desc", "updated_desc", "title_asc"];
  const sortParam = params.sort && allowedSorts.includes(params.sort as IdeaSort) ? (params.sort as IdeaSort) : undefined;
  const [data, deleted, user] = await Promise.all([
    loadIdeas({ q: params.q, cursor: params.cursor, sort: sortParam }),
    loadDeletedIdeas(),
    requireUser(),
  ]);

  // Track journey progress
  await trackJourneyAction(user.id, "visit_dashboard");
  await trackJourneyAction(user.id, "view_ideas_list");

  return (
    <IdeasContentWrapper>
      <section className="space-y-6">
        <IdeaComposerLauncher />
        <IdeaBoard
          ideas={data.items}
          deleted={deleted}
          query={params.q}
          sort={sortParam ?? "priority"}
          viewerId={data.viewerId}
        />
        {data.nextCursor ? <LoadMore cursor={data.nextCursor} /> : null}
      </section>
    </IdeasContentWrapper>
  );
}
