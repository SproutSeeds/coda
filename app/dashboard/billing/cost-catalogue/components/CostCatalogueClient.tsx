"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CircleDollarSign, Filter, Info, Layers, MoveRight, RefreshCw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recordCostCatalogueEvent } from "../actions";
import type { CostCatalogueAction, CostCatalogueAllowances, CostCatalogueMatrix } from "@/lib/limits/catalogue";

type FilterState = {
  tab: "category" | "vendor" | "plan";
  category: string | null;
  vendor: string | null;
  plan: string | null;
};

type CostCatalogueClientProps = {
  matrix: CostCatalogueMatrix;
  allowances: CostCatalogueAllowances | null;
  initialFilters: FilterState;
};

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const CACHE_STALE_THRESHOLD_MS = 15 * 60 * 1000;

export function CostCatalogueClient({ matrix, allowances, initialFilters }: CostCatalogueClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [pending, startTransition] = useTransition();

  const vendors = useMemo(() => Array.from(new Set(matrix.actions.map((action) => action.vendor))).sort(), [matrix.actions]);
  const categoryIds = useMemo(() => matrix.categories.map((category) => category.id), [matrix.categories]);
  const planIds = useMemo(() => matrix.plans.map((plan) => plan.id), [matrix.plans]);

  const resolvedPlan = useMemo(() => {
    if (initialFilters.plan && planIds.includes(initialFilters.plan)) return initialFilters.plan;
    if (allowances?.plan.id && planIds.includes(allowances.plan.id)) return allowances.plan.id;
    return planIds[0] ?? null;
  }, [allowances?.plan.id, initialFilters.plan, planIds]);

  const [activeTab, setActiveTab] = useState<FilterState["tab"]>(initialFilters.tab ?? "category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialFilters.category && categoryIds.includes(initialFilters.category) ? initialFilters.category : null,
  );
  const [selectedVendor, setSelectedVendor] = useState<string | null>(
    initialFilters.vendor && vendors.includes(initialFilters.vendor) ? initialFilters.vendor : null,
  );
  const [selectedPlan, setSelectedPlan] = useState<string | null>(resolvedPlan);

  useEffect(() => {
    if (!selectedPlan && resolvedPlan) {
      setSelectedPlan(resolvedPlan);
    }
  }, [resolvedPlan, selectedPlan]);

  const filterSelectRef = useRef<HTMLSelectElement | null>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "f" || event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.getAttribute("contenteditable") === "true")) {
        return;
      }
      event.preventDefault();
      filterSelectRef.current?.focus();
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    updateParam(params, "tab", activeTab, "category");
    updateParam(params, "category", selectedCategory, null);
    updateParam(params, "vendor", selectedVendor, null);
    updateParam(params, "plan", selectedPlan, resolvedPlan);
    startTransition(() => {
      router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
      recordCostCatalogueEvent({
        type: "filter",
        payload: {
          tab: activeTab,
          category: selectedCategory,
          vendor: selectedVendor,
          plan: selectedPlan,
        },
      }).catch(() => {
        /* swallow analytics errors */
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedCategory, selectedVendor, selectedPlan]);

  const planContext = useMemo(() => {
    const effectivePlanId = selectedPlan && planIds.includes(selectedPlan) ? selectedPlan : resolvedPlan;
    const plan = matrix.plans.find((row) => row.id === effectivePlanId) ?? matrix.plans[0] ?? null;
    return { planId: effectivePlanId, plan };
  }, [matrix.plans, planIds, resolvedPlan, selectedPlan]);

  const filteredActions = useMemo(() => {
    return matrix.actions.filter((action) => {
      if (selectedCategory && action.category !== selectedCategory) return false;
      if (selectedVendor && action.vendor !== selectedVendor) return false;
      if (planContext.planId) {
        return action.planLimits.some((limit) => limit.planId === planContext.planId);
      }
      return true;
    });
  }, [matrix.actions, selectedCategory, selectedVendor, planContext.planId]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, CostCatalogueAction[]>();
    for (const category of matrix.categories) {
      map.set(category.id, []);
    }
    for (const action of filteredActions) {
      if (!map.has(action.category)) {
        map.set(action.category, []);
      }
      map.get(action.category)!.push(action);
    }
    return map;
  }, [filteredActions, matrix.categories]);

  const groupedByVendor = useMemo(() => {
    const map = new Map<string, CostCatalogueAction[]>();
    for (const action of filteredActions) {
      const bucket = map.get(action.vendor) ?? [];
      bucket.push(action);
      map.set(action.vendor, bucket);
    }
    return map;
  }, [filteredActions]);

  const tableRows = useMemo(() => {
    if (!planContext.planId) return [] as Array<{ action: CostCatalogueAction; limit: number | null; warnThreshold: number | null; period: string | null }>;
    return filteredActions.map((action) => {
      const details = action.planLimits.find((limit) => limit.planId === planContext.planId);
      return {
        action,
        limit: details?.limit ?? null,
        warnThreshold: details?.warnThreshold ?? null,
        period: details?.period ?? null,
      };
    });
  }, [filteredActions, planContext.planId]);

  const isCached = useMemo(() => {
    const generated = new Date(matrix.generatedAt).getTime();
    if (Number.isNaN(generated)) return false;
    return Date.now() - generated > CACHE_STALE_THRESHOLD_MS;
  }, [matrix.generatedAt]);

  const creditsAvailable = allowances?.credits?.available ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cost catalogue</h1>
            <p className="text-sm text-muted-foreground">
              Inspect vendor costs, credit impact, and plan guardrails for every billable action.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/usage">Open usage dashboard</Link>
          </Button>
        </div>
        {isCached ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-amber-400/80 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            <Info className="h-4 w-4" aria-hidden="true" />
            <span>Showing cached catalogue data while we refresh the vendor matrix.</span>
          </div>
        ) : null}
        {!allowances ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-600">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Live usage metrics are unavailable. Limits reflect baseline plan defaults.</span>
          </div>
        ) : null}
        <SummaryStrip allowances={allowances} availableCredits={creditsAvailable} plan={planContext.plan ?? null} />
        <FilterTray
          categories={matrix.categories}
          vendors={vendors}
          plans={matrix.plans}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          selectedPlan={selectedPlan}
          onPlanChange={setSelectedPlan}
          onReset={() => {
            setSelectedCategory(null);
            setSelectedVendor(null);
            setSelectedPlan(resolvedPlan);
          }}
          filterRef={filterSelectRef}
          pending={pending}
        />
      </header>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FilterState["tab"])}>
        <TabsList aria-label="Cost catalogue grouping">
          <TabsTrigger value="category">By category</TabsTrigger>
          <TabsTrigger value="vendor">By vendor</TabsTrigger>
          <TabsTrigger value="plan">By plan tier</TabsTrigger>
        </TabsList>
        <TabsContent value="category">
          <div className="space-y-8" aria-live="polite">
            {matrix.categories.map((category) => {
              const actions = groupedByCategory.get(category.id) ?? [];
              if (actions.length === 0) return null;
              return (
                <section key={category.id} className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{category.label}</h2>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                  <ActionGrid
                    actions={actions}
                    allowances={allowances}
                    planId={planContext.planId}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                </section>
              );
            })}
            {filteredActions.length === 0 ? <EmptyState /> : null}
          </div>
        </TabsContent>
        <TabsContent value="vendor">
          <div className="space-y-8" aria-live="polite">
            {Array.from(groupedByVendor.entries())
              .sort(([vendorA], [vendorB]) => vendorA.localeCompare(vendorB))
              .map(([vendor, actions]) => (
                <section key={vendor} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-lg font-semibold text-foreground">{vendor}</h2>
                  </div>
                  <ActionGrid
                    actions={actions}
                    allowances={allowances}
                    planId={planContext.planId}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                </section>
              ))}
            {filteredActions.length === 0 ? <EmptyState /> : null}
          </div>
        </TabsContent>
        <TabsContent value="plan">
          <PlanTable
            rows={tableRows}
            plan={planContext.plan}
            allowances={allowances}
            currencyFormatter={currencyFormatter}
            numberFormatter={numberFormatter}
          />
        </TabsContent>
      </Tabs>

      <CostLegend />
    </div>
  );
}

type FilterTrayProps = {
  categories: CostCatalogueMatrix["categories"];
  vendors: string[];
  plans: CostCatalogueMatrix["plans"];
  selectedCategory: string | null;
  onCategoryChange: (value: string | null) => void;
  selectedVendor: string | null;
  onVendorChange: (value: string | null) => void;
  selectedPlan: string | null;
  onPlanChange: (value: string | null) => void;
  onReset: () => void;
  filterRef: React.RefObject<HTMLSelectElement>;
  pending: boolean;
};

function FilterTray({
  categories,
  vendors,
  plans,
  selectedCategory,
  onCategoryChange,
  selectedVendor,
  onVendorChange,
  selectedPlan,
  onPlanChange,
  onReset,
  filterRef,
  pending,
}: FilterTrayProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" aria-hidden="true" />
        <span>Filters</span>
      </div>
      <div className="grid flex-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Category
          <select
            ref={filterRef}
            className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedCategory ?? ""}
            onChange={(event) => onCategoryChange(event.target.value ? event.target.value : null)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Vendor
          <select
            className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedVendor ?? ""}
            onChange={(event) => onVendorChange(event.target.value ? event.target.value : null)}
          >
            <option value="">All vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Plan tier
          <select
            className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedPlan ?? ""}
            onChange={(event) => onPlanChange(event.target.value ? event.target.value : null)}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button variant="ghost" size="sm" onClick={onReset} disabled={pending}>
        Reset
      </Button>
    </div>
  );
}

type ActionGridProps = {
  actions: CostCatalogueAction[];
  allowances: CostCatalogueAllowances | null;
  planId: string | null;
  prefersReducedMotion: boolean;
};

function ActionGrid({ actions, allowances, planId, prefersReducedMotion }: ActionGridProps) {
  if (actions.length === 0) {
    return <EmptyState />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((action, index) => (
        <CostBreakdownCard
          key={action.action}
          action={action}
          allowances={allowances}
          planId={planId}
          prefersReducedMotion={prefersReducedMotion}
          index={index}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
      No catalogue entries match the current filters.
    </div>
  );
}

type CostBreakdownCardProps = {
  action: CostCatalogueAction;
  allowances: CostCatalogueAllowances | null;
  planId: string | null;
  prefersReducedMotion: boolean;
  index: number;
};

function CostBreakdownCard({ action, allowances, planId, prefersReducedMotion, index }: CostBreakdownCardProps) {
  const [pending, startTransition] = useTransition();
  const planDetails = planId ? action.planLimits.find((limit) => limit.planId === planId) ?? null : null;
  const metricUsage = action.metric ? allowances?.metricsById[action.metric] ?? null : null;
  const usageStatus = metricUsage?.status ?? "unlimited";
  const warnThreshold = planDetails?.warnThreshold ?? null;
  const limit = planDetails?.limit ?? null;
  const progressPercent = metricUsage?.progressPercent ?? 0;

  const motionProps = prefersReducedMotion
    ? undefined
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: index * 0.05 },
      } as const;

  const statusColor = usageStatus === "blocked" ? "text-rose-500" : usageStatus === "warn" ? "text-amber-500" : "text-muted-foreground";

  const cta = resolveCta(action);

  return (
    <motion.div {...motionProps}>
      <Card className="h-full border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold text-foreground">
            <span>{action.label}</span>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {action.category}
            </span>
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">{action.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
            <span>
              Vendor cost {currencyFormatter.format(action.unitCostUsd)} / {action.unit}
              {action.creditsPerUnit ? ` • ${numberFormatter.format(action.creditsPerUnit)} credits` : ""}
            </span>
          </div>
          {typeof action.defaultCreditCharge === "number" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Layers className="h-4 w-4" aria-hidden="true" />
              <span>Default debit: {numberFormatter.format(action.defaultCreditCharge)} credits</span>
            </div>
          ) : null}
          {planDetails ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Plan limit</span>
                <span className={statusColor}>{usageStatus}</span>
              </div>
              <div className="mt-1 text-sm text-foreground">
                {limit != null ? `${numberFormatter.format(limit)} max (${planDetails.period ?? "lifetime"})` : "Unlimited"}
              </div>
              {warnThreshold != null ? (
                <div className="text-xs text-muted-foreground">Warn at {numberFormatter.format(warnThreshold)}.</div>
              ) : null}
              {metricUsage ? (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Usage</span>
                    <span>
                      {numberFormatter.format(metricUsage.count)}
                      {limit != null ? ` / ${numberFormatter.format(limit)}` : ""}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${usageStatus === "blocked" ? "bg-rose-500" : usageStatus === "warn" ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, progressPercent)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>{action.vendor}</span>
          </div>
          {cta ? (
            <Button
              variant={cta.variant}
              size="sm"
              asChild
              onClick={() => {
                startTransition(() => {
                  recordCostCatalogueEvent({
                    type: "cta",
                    payload: {
                      actionId: action.action,
                      cta: cta.label,
                      href: cta.href,
                    },
                  }).catch(() => undefined);
                });
              }}
            >
              <Link href={cta.href} className="inline-flex items-center gap-1" prefetch={false}>
                {cta.label}
                <MoveRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

type SummaryStripProps = {
  allowances: CostCatalogueAllowances | null;
  availableCredits: number;
  plan: CostCatalogueMatrix["plans"][number] | null;
};

function SummaryStrip({ allowances, availableCredits, plan }: SummaryStripProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="border-border/70 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Current plan</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          {plan ? plan.name : "Unknown"}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Available credits</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">{numberFormatter.format(availableCredits)}</CardContent>
      </Card>
      <Card className="border-border/70 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Auto top-up</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          {allowances?.credits.autoTopUpEnabled
            ? `Enabled at ${numberFormatter.format(allowances.credits.autoTopUpThreshold)} credits`
            : "Disabled"}
        </CardContent>
      </Card>
    </div>
  );
}

type PlanTableProps = {
  rows: Array<{ action: CostCatalogueAction; limit: number | null; warnThreshold: number | null; period: string | null }>;
  plan: CostCatalogueMatrix["plans"][number] | null;
  allowances: CostCatalogueAllowances | null;
  currencyFormatter: Intl.NumberFormat;
  numberFormatter: Intl.NumberFormat;
};

function PlanTable({ rows, plan, allowances, currencyFormatter, numberFormatter }: PlanTableProps) {
  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">Plan coverage — {plan?.name ?? "Unknown plan"}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Compare limits, warn thresholds, and current usage for the selected plan tier.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-border/60 text-sm">
          <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Vendor cost</th>
              <th className="px-4 py-3 text-left">Limit</th>
              <th className="px-4 py-3 text-left">Warn at</th>
              <th className="px-4 py-3 text-left">Usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map(({ action, limit, warnThreshold }) => {
              const metricUsage = action.metric ? allowances?.metricsById[action.metric] ?? null : null;
              return (
                <tr key={`${action.action}-${plan?.id ?? "plan"}`} className="text-foreground/90">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.description}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {currencyFormatter.format(action.unitCostUsd)} / {action.unit}
                  </td>
                  <td className="px-4 py-3">{limit != null ? numberFormatter.format(limit) : "Unlimited"}</td>
                  <td className="px-4 py-3">{warnThreshold != null ? numberFormatter.format(warnThreshold) : "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {metricUsage ? `${numberFormatter.format(metricUsage.count)}${limit != null ? ` / ${numberFormatter.format(limit)}` : ""}` : "n/a"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CostLegend() {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-xs text-muted-foreground">
      <h2 className="text-sm font-semibold text-foreground">Legend</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        <li className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
          <span>Vendor cost (USD) and credit conversion per unit.</span>
        </li>
        <li className="flex items-center gap-2">
          <Layers className="h-4 w-4" aria-hidden="true" />
          <span>Default credit debit applied when the action succeeds.</span>
        </li>
        <li className="flex items-center gap-2">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>Vendor powering the action or resource.</span>
        </li>
        <li className="flex items-center gap-2">
          <Info className="h-4 w-4" aria-hidden="true" />
          <span>Status reflects live usage when available; otherwise defaults to baseline limits.</span>
        </li>
      </ul>
    </div>
  );
}

type CtaConfig = { label: string; href: string; variant: "default" | "secondary" | "outline" } | null;

function resolveCta(action: CostCatalogueAction): CtaConfig {
  switch (action.cta) {
    case "upgrade":
      return { label: "Review plans", href: "/dashboard/account", variant: "secondary" };
    case "top-up":
      return { label: "Top up credits", href: "/dashboard/usage", variant: "default" };
    case "docs":
      return { label: "View docs", href: action.documentationUrl ?? "/docs/usage-limits-and-pricing", variant: "outline" };
    default:
      return null;
  }
}

function updateParam(params: URLSearchParams, key: string, value: string | null, defaultValue: string | null) {
  if (!value || value === defaultValue) {
    params.delete(key);
    return;
  }
  params.set(key, value);
}
