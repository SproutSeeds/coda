export type UsageUnit = "units" | "minutes" | "bytes" | "emails" | "requests" | "rows" | "credits";

export type UsageCategory = "creation" | "collaboration" | "delivery" | "authentication" | "analytics" | "devmode";

export type CostModelEntry = {
  label: string;
  description: string;
  category: UsageCategory;
  vendor: string;
  unit: UsageUnit;
  unitLabel: string;
  unitCost: number; // USD cost per unit (includes safety buffer)
};

export type UsageAction =
  | "idea.create"
  | "feature.create"
  | "collaborator.invite"
  | "collaborator.add"
  | "join-request.create"
  | "idea.export"
  | "auth.email"
  | "analytics.event"
  | "devmode.minute"
  | "devmode.byte";

export const COST_MODEL: Record<UsageAction, CostModelEntry> = {
  "idea.create": {
    label: "Idea creation",
    description: "Creating a new idea shell with default collaborators and metadata.",
    category: "creation",
    vendor: "neon_postgres",
    unit: "rows",
    unitLabel: "rows",
    unitCost: 0.0000005,
  },
  "feature.create": {
    label: "Feature creation",
    description: "Adding a feature/spec row to an existing idea.",
    category: "creation",
    vendor: "neon_postgres",
    unit: "rows",
    unitLabel: "rows",
    unitCost: 0.00000054,
  },
  "collaborator.invite": {
    label: "Collaborator invite email",
    description: "Sending a transactional invite email via Resend.",
    category: "collaboration",
    vendor: "email_delivery",
    unit: "emails",
    unitLabel: "emails",
    unitCost: 0.0004003,
  },
  "collaborator.add": {
    label: "Collaborator accepted",
    description: "Accepting an invite or adding a collaborator directly.",
    category: "collaboration",
    vendor: "neon_postgres",
    unit: "rows",
    unitLabel: "rows",
    unitCost: 0.0000004,
  },
  "join-request.create": {
    label: "Join request",
    description: "Submitting a join request for an idea (viewer → owner).",
    category: "collaboration",
    vendor: "neon_postgres",
    unit: "rows",
    unitLabel: "rows",
    unitCost: 0.0000005,
  },
  "idea.export": {
    label: "Idea export",
    description: "Exporting an idea to JSON/CSV including features and collaborators.",
    category: "delivery",
    vendor: "vercel_bandwidth",
    unit: "requests",
    unitLabel: "exports",
    unitCost: 0.000008,
  },
  "auth.email": {
    label: "Auth email",
    description: "Sending sign-in or password reset emails.",
    category: "authentication",
    vendor: "email_delivery",
    unit: "emails",
    unitLabel: "emails",
    unitCost: 0.0004,
  },
  "analytics.event": {
    label: "Analytics event",
    description: "Recording a single analytics datapoint via Vercel Analytics.",
    category: "analytics",
    vendor: "vercel_analytics",
    unit: "requests",
    unitLabel: "events",
    unitCost: 0.0000012,
  },
  "devmode.minute": {
    label: "Dev Mode minute",
    description: "One minute of remote Dev Mode relay time on Fly.io.",
    category: "devmode",
    vendor: "devmode_compute",
    unit: "minutes",
    unitLabel: "minutes",
    unitCost: 0.000048,
  },
  "devmode.byte": {
    label: "Dev Mode bandwidth",
    description: "Bytes transferred through the Dev Mode relay tunnel.",
    category: "devmode",
    vendor: "devmode_bandwidth",
    unit: "bytes",
    unitLabel: "bytes",
    unitCost: 0.000000004,
  },
};

export const USAGE_PROJECTION_BUDGETS = [5, 20, 100] as const;

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const decimalNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatBudgetLabel(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function formatUnits(units: number): string {
  if (!Number.isFinite(units) || units <= 0) {
    return "0";
  }

  if (units >= 1000) {
    return compactNumberFormatter.format(units);
  }

  return decimalNumberFormatter.format(units);
}

function formatProjectionSummary(budgetUsd: number, unitsPurchasable: number, unitLabel: string): string {
  if (!Number.isFinite(unitsPurchasable) || unitsPurchasable <= 0) {
    return `${formatBudgetLabel(budgetUsd)} — insufficient data`;
  }

  return `${formatBudgetLabel(budgetUsd)} ≈ ${formatUnits(unitsPurchasable)} ${unitLabel}`;
}

export type UsageCostBudget = {
  budgetUsd: number;
  unitsPurchasable: number;
  summary: string;
};

export function getUsageCostBudgets(action: UsageAction, budgets = USAGE_PROJECTION_BUDGETS): UsageCostBudget[] {
  const entry = COST_MODEL[action];

  return budgets.map((budgetUsd) => {
    const unitsPurchasable = entry.unitCost > 0 ? budgetUsd / entry.unitCost : Number.POSITIVE_INFINITY;

    return {
      budgetUsd,
      unitsPurchasable,
      summary: formatProjectionSummary(budgetUsd, unitsPurchasable, entry.unitLabel),
    };
  });
}

export function listCostModelEntries(): Array<{ action: UsageAction } & CostModelEntry> {
  return (Object.entries(COST_MODEL) as Array<[UsageAction, CostModelEntry]>).map(([action, entry]) => ({
    action,
    ...entry,
  }));
}

export function getCostModel(action: UsageAction) {
  return COST_MODEL[action];
}
