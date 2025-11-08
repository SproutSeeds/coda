import { requirePlatformAdmin } from "@/lib/auth/admin";

import {
  getLimitInsightsAction,
  listPendingLimitOverridesAction,
} from "./actions";
import { CreateOverrideCard } from "./CreateOverrideCard";
import { LimitInsights } from "./LimitInsights";
import { PendingOverridesTable } from "./PendingOverridesTable";

export const metadata = {
  title: "Limit overrides",
};

export default async function AdminLimitsPage() {
  await requirePlatformAdmin();

  const [pending, insights] = await Promise.all([
    listPendingLimitOverridesAction({ limit: 200 }),
    getLimitInsightsAction(),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Limit overrides</h1>
        <p className="text-sm text-muted-foreground">
          Review escalation requests, apply manual overrides, and monitor warn/block activity.
        </p>
      </header>
      <LimitInsights summary={insights} />
      <CreateOverrideCard />
      <PendingOverridesTable initialOverrides={pending} />
    </div>
  );
}
