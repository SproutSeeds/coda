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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Discover public ideas</h1>
          <p className="text-sm text-muted-foreground">
            Explore ideas shared by the community. Public ideas are read-only unless you&apos;re invited to collaborate.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="interactive-btn whitespace-nowrap text-xs font-semibold uppercase">
          <Link href="/dashboard/ideas">Back to my ideas</Link>
        </Button>
      </header>

      <PublicIdeaGallery ideas={items} viewerId={user?.id ?? null} />
      {nextCursor ? <LoadMore cursor={nextCursor} /> : null}
    </section>
  );
}
