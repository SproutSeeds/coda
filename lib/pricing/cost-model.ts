export type UsageUnit = "units" | "minutes" | "bytes" | "emails" | "requests" | "rows" | "credits";

export type CostModelEntry = {
  vendor: string;
  unit: UsageUnit;
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
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.0002, // covers inserts + storage buffer
  },
  "feature.create": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.00015,
  },
  "collaborator.invite": {
    vendor: "email_delivery",
    unit: "emails",
    unitCost: 0.011, // transactional email cost + buffer
  },
  "collaborator.add": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.00025,
  },
  "join-request.create": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.00018,
  },
  "idea.export": {
    vendor: "vercel_bandwidth",
    unit: "requests",
    unitCost: 0.0025,
  },
  "auth.email": {
    vendor: "email_delivery",
    unit: "emails",
    unitCost: 0.0125,
  },
  "analytics.event": {
    vendor: "vercel_analytics",
    unit: "requests",
    unitCost: 0.0005,
  },
  "devmode.minute": {
    vendor: "devmode_compute",
    unit: "minutes",
    unitCost: 0.015,
  },
  "devmode.byte": {
    vendor: "devmode_bandwidth",
    unit: "bytes",
    unitCost: 1.2e-10,
  },
};

export function getCostModel(action: UsageAction) {
  return COST_MODEL[action];
}
