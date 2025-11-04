import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { listPublicIdeas } from "@/lib/db/ideas";

import { PublicIdeaGallery } from "../components/PublicIdeaGallery";
import { LoadMore } from "../components/LoadMore";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Discover public ideas",
};

export default async function DiscoverIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const { items, nextCursor } = await listPublicIdeas(user?.id ?? null, 24, params.cursor);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold leading-tight tracking-wide text-foreground sm:text-xl">
            Discover public ideas
          </h1>
          <p className="text-sm tracking-tight text-muted-foreground">
            Explore ideas shared by the community. Public ideas are read-only unless you&apos;re invited to collaborate.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="interactive-btn self-start whitespace-nowrap text-xs font-semibold uppercase sm:self-end"
        >
          <Link href="/dashboard/ideas">Back to my ideas</Link>
        </Button>
      </header>

      <PublicIdeaGallery ideas={items} viewerId={user?.id ?? null} />
      {nextCursor ? <LoadMore cursor={nextCursor} /> : null}
    </section>
  );
}
