import { loadDeletedIdeas, loadIdeas } from "./actions";
import { IdeaComposer } from "./components/IdeaComposer";
import { IdeaBoard } from "./components/IdeaBoard";
import { SearchBar } from "./components/SearchBar";
import { LoadMore } from "./components/LoadMore";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const [data, deleted] = await Promise.all([
    loadIdeas({ q: params.q, cursor: params.cursor }),
    loadDeletedIdeas(),
  ]);

  return (
    <section className="space-y-6">
      <IdeaComposer />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-semibold">Ideas</h2>
        <SearchBar />
      </div>
      <IdeaBoard ideas={data.items} deleted={deleted} query={params.q} />
      {data.nextCursor ? <LoadMore cursor={data.nextCursor} /> : null}
    </section>
  );
}
