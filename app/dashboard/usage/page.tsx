import { Suspense } from "react";

import { requireUser } from "@/lib/auth/session";
import { getUserUsageDashboard } from "@/lib/usage/analytics";

import { UsageDashboardClient } from "./UsageDashboardClient";

async function UsageDashboardContent() {
  const user = await requireUser();
  const userId = user.id;

  const analytics = await getUserUsageDashboard(userId, 30);

  return <UsageDashboardClient analytics={analytics} />;
}

export default function UsageDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 p-8">
          <div className="mx-auto max-w-7xl">
            <div className="space-y-6">
              <div className="h-8 w-1/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                ))}
              </div>
              <div className="h-96 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      }
    >
      <UsageDashboardContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
