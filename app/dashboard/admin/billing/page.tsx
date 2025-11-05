import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listUsageAggregatesAction, listCreditBalancesAction } from "./actions";
import { BillingDashboard } from "./BillingDashboard";

export const metadata = {
  title: "Billing console",
};

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const [usageAggregates, creditBalances] = await Promise.all([
    listUsageAggregatesAction(100),
    listCreditBalancesAction(100),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Billing console</h1>
        <p className="text-sm text-muted-foreground">
          Monitor high-cost users, shared pools, and manually grant credits when needed.
        </p>
      </header>
      <BillingDashboard usageAggregates={usageAggregates} creditBalances={creditBalances} />
    </div>
  );
}
