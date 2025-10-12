import type { IdeaSort } from "@/lib/db/ideas";

import { loadDeletedIdeas, loadIdeas } from "./actions";
import { IdeaComposerLauncher } from "./components/IdeaComposer";
import { IdeaBoard } from "./components/IdeaBoard";
import { LoadMore } from "./components/LoadMore";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const allowedSorts: IdeaSort[] = ["priority", "created_desc", "updated_desc", "title_asc"];
  const sortParam = params.sort && allowedSorts.includes(params.sort as IdeaSort) ? (params.sort as IdeaSort) : undefined;
  const [data, deleted] = await Promise.all([
    loadIdeas({ q: params.q, cursor: params.cursor, sort: sortParam }),
    loadDeletedIdeas(),
  ]);

  return (
    <section className="space-y-6">
      <IdeaComposerLauncher />
      <IdeaBoard ideas={data.items} deleted={deleted} query={params.q} sort={sortParam ?? "priority"} />
      {data.nextCursor ? <LoadMore cursor={data.nextCursor} /> : null}
    </section>
  );
}
