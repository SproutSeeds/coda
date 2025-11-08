import type { UsageAction, UsageCategory, UsageCostBudget, UsageUnit } from "@/lib/pricing/cost-model";

export type CategoryKey = UsageCategory;

export type StorageCategory = "text" | "media" | "audio";

export type StorageUsagePoint = {
  date: string;
  textBytes: number;
  mediaBytes: number;
  audioBytes: number;
};

export type StorageTotals = Record<StorageCategory, number>;

export type StorageCostPoint = {
  date: string;
  textCost: number;
  mediaCost: number;
  audioCost: number;
};

export type StorageCostTotals = Record<StorageCategory, number>;

export type StorageCostProjection = {
  budgetUsd: number;
  gigabytes: number;
  summary: string;
};

export type LifetimeUsageStats = {
  actionCost: number;
  storageCost: number;
  storageFootprint: StorageTotals;
  storageCostTotals: StorageCostTotals;
};

export type DailyCostData = {
  date: string;
  creation: number;
  collaboration: number;
  delivery: number;
  authentication: number;
  analytics: number;
  devmode: number;
};

export type CategoryBreakdown = {
  category: CategoryKey;
  label: string;
  icon: string;
  color: string;
  actionCount: number;
  totalCost: number;
  percentage: number;
};

export type TopAction = {
  action: string;
  label: string;
  count: number;
  totalCost: number;
  quantity: number;
  unit: string;
};

export type ActionCostDetail = {
  action: UsageAction;
  label: string;
  category: CategoryKey;
  description: string;
  vendor: string;
  unit: UsageUnit;
  unitLabel: string;
  unitCost: number;
  quantity: number;
  totalCost: number;
  lastOccurredAtIso: string | null;
  projections: UsageCostBudget[];
};

export type CategoryActionGroup = {
  category: CategoryKey;
  label: string;
  description: string;
  color: string;
  icon: string;
  totalQuantity: number;
  totalCost: number;
  actions: ActionCostDetail[];
};

export type StorageCategoryGroup = {
  category: StorageCategory;
  label: string;
  description: string;
  color: string;
  vendor: string;
  unitLabel: string;
  unitCost: number;
  totalBytes: number;
  totalCost: number;
  lastMeasuredAtIso: string | null;
  projections: StorageCostProjection[];
};

export type UsageDashboardData = {
  dailyCosts: DailyCostData[];
  categoryBreakdown: CategoryBreakdown[];
  topActions: TopAction[];
  totalCost: number;
  actionCostTotal: number;
  storageCostTotal: number;
  currentPeriodStartIso: string;
  currentPeriodEndIso: string;
  storageTimeline: StorageUsagePoint[];
  storageFootprint: StorageTotals;
  storageCostTimeline: StorageCostPoint[];
  storageCostTotals: StorageCostTotals;
  lifetime: LifetimeUsageStats;
  actionCostDetails: ActionCostDetail[];
  actionCategoryGroups: CategoryActionGroup[];
  storageCategoryGroups: StorageCategoryGroup[];
};

export type UsageOverviewClientPayload = {
  credit: {
    available: number;
    onHold: number;
    updatedAtIso: string;
  };
  costAggregates: Array<{
    action: string;
    label: string;
    category: CategoryKey | null;
    vendor: string;
    unit: string;
    unitLabel: string | null;
    unitCost: number | null;
    totalQuantity: number;
    totalCost: number;
    occurrences: number;
    lastOccurredAtIso: string | null;
    projections: UsageCostBudget[] | null;
  }>;
  recentLedger: Array<{
    id: string;
    action: string;
    vendor: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    occurredAtIso: string;
  }>;
};
