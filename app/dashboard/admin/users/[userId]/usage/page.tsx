import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getUserUsageDashboard } from "@/lib/usage/analytics";
import { UsageDashboardClient } from "@/app/dashboard/usage/UsageDashboardClient";

type AdminUserUsagePageProps = {
  params: {
    userId: string;
  };
};

export const metadata = {
  title: "Usage inspector",
};

export const dynamic = "force-dynamic";

export default async function AdminUserUsagePage({ params }: AdminUserUsagePageProps) {
  await requirePlatformAdmin();

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!user) {
    notFound();
  }

  const analytics = await getUserUsageDashboard(user.id, 90);
  const displayName = user.name || user.email || "Unknown user";
  const secondaryLabel = user.name && user.email ? user.email : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usage inspector</p>
          <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
          {secondaryLabel ? <p className="text-sm text-muted-foreground">{secondaryLabel}</p> : null}
          <p className="text-sm text-muted-foreground">
            User ID: <code className="rounded bg-muted px-2 py-0.5 text-xs">{user.id}</code>
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/admin/billing">
            <ArrowLeft className="mr-2 size-4" />
            Back to billing console
          </Link>
        </Button>
      </div>
      <UsageDashboardClient analytics={analytics} />
    </div>
  );
}
