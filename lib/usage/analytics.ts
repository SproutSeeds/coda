import "server-only";

import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageCosts } from "@/lib/db/schema/usage";
import { ACTION_CATEGORY_MAP, CATEGORY_METADATA, CATEGORY_ORDER } from "@/lib/usage/categories";
import {
  STORAGE_ACTION_MAP,
  STORAGE_CATEGORY_METADATA,
  STORAGE_CATEGORY_ORDER,
  STORAGE_FIELD_MAP,
  calculateDailyStorageCost,
  calculateStorageProjections,
} from "@/lib/usage/storage";
import {
  COST_MODEL,
  getUsageCostBudgets,
  listCostModelEntries,
  type UsageAction,
} from "@/lib/pricing/cost-model";
import type {
  CategoryBreakdown,
  CategoryKey,
  DailyCostData,
  LifetimeUsageStats,
  ActionCostDetail,
  StorageCostPoint,
  StorageCostTotals,
  StorageTotals,
  StorageUsagePoint,
  StorageCategory,
  CategoryActionGroup,
  StorageCategoryGroup,
  TopAction,
  UsageDashboardData,
} from "@/lib/usage/types";

const ACTION_LABELS: Record<string, string> = {
  "idea.create": "Ideas Created",
  "feature.create": "Features Created",
  "collaborator.invite": "Collaborator Invites",
  "collaborator.add": "Collaborators Added",
  "join-request.create": "Join Requests",
  "idea.export": "Idea Exports",
  "auth.email": "Auth Emails",
  "analytics.event": "Analytics Events",
  "devmode.minute": "DevMode Sessions",
  "devmode.byte": "DevMode Bandwidth",
};

function parseDecimal(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isUsageAction(action: string): action is UsageAction {
  return Object.prototype.hasOwnProperty.call(COST_MODEL, action);
}

export async function getUserUsageDashboard(userId: string, days = 30): Promise<UsageDashboardData> {
  const db = getDb();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  // Fetch all usage costs for the period
  const costs = await db
    .select()
    .from(usageCosts)
    .where(
      and(
        eq(usageCosts.payerType, "user"),
        eq(usageCosts.payerId, userId),
        gte(usageCosts.occurredAt, startDate)
      )
    );

  const costModelEntries = listCostModelEntries();

  // Group by day and category for the area chart
  const dailyMap = new Map<string, Record<CategoryKey, number>>();
  const storageDailyMap = new Map<string, { textBytes: number; mediaBytes: number; audioBytes: number }>();
  const categoryTotals = new Map<CategoryKey, { count: number; cost: number }>();
  const actionDetailsMap = new Map<UsageAction, ActionCostDetail>();
  const actionStats = new Map<UsageAction, { count: number; lastOccurredAt: Date | null }>();
  for (const entry of costModelEntries) {
    actionDetailsMap.set(entry.action, {
      action: entry.action,
      label: entry.label,
      category: entry.category,
      description: entry.description,
      vendor: entry.vendor,
      unit: entry.unit,
      unitLabel: entry.unitLabel,
      unitCost: entry.unitCost,
      quantity: 0,
      totalCost: 0,
      lastOccurredAtIso: null,
      projections: getUsageCostBudgets(entry.action),
    });
    actionStats.set(entry.action, { count: 0, lastOccurredAt: null });
  }
  let storageFootprint: StorageTotals = {
    text: 0,
    media: 0,
    audio: 0,
  };
  const storageCostTotals: StorageCostTotals = {
    text: 0,
    media: 0,
    audio: 0,
  };
  const storageLastMeasured: Record<StorageCategory, string | null> = {
    text: null,
    media: null,
    audio: null,
  };

  let actionCostTotal = 0;

  for (const cost of costs) {
    const date = new Date(cost.occurredAt).toISOString().split("T")[0];
    const category = ACTION_CATEGORY_MAP[cost.action] || "analytics";
    const costValue = parseDecimal(cost.totalCost);
    const quantity = parseDecimal(cost.quantity);
    const actionKey = isUsageAction(cost.action) ? cost.action : null;
    const occurredAt =
      cost.occurredAt instanceof Date
        ? cost.occurredAt
        : cost.occurredAt
          ? new Date(cost.occurredAt)
          : null;

    actionCostTotal += costValue;

    // Daily data
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        creation: 0,
        collaboration: 0,
        delivery: 0,
        authentication: 0,
        analytics: 0,
        devmode: 0,
      });
    }
    const dayData = dailyMap.get(date)!;
    dayData[category] += costValue;

    const storageCategory = STORAGE_ACTION_MAP[cost.action];
    if (storageCategory) {
      if (!storageDailyMap.has(date)) {
        storageDailyMap.set(date, { textBytes: 0, mediaBytes: 0, audioBytes: 0 });
      }
      const storageDay = storageDailyMap.get(date)!;
      const field = STORAGE_FIELD_MAP[storageCategory];
      storageDay[field] += quantity;
    }

    // Category totals
    const catData = categoryTotals.get(category) || { count: 0, cost: 0 };
    catData.count += 1;
    catData.cost += costValue;
    categoryTotals.set(category, catData);

    // Action totals
    if (actionKey) {
      const actionDetail = actionDetailsMap.get(actionKey);
      if (actionDetail) {
        actionDetail.quantity += quantity;
        actionDetail.totalCost += costValue;

        const stats = actionStats.get(actionKey);
        if (stats) {
          stats.count += 1;
          if (occurredAt && (!stats.lastOccurredAt || stats.lastOccurredAt < occurredAt)) {
            stats.lastOccurredAt = occurredAt;
          }
        }
      }
    }
  }

  // Build daily cost array
  const dailyCosts: DailyCostData[] = [];
  const storageTimeline: StorageUsagePoint[] = [];
  const storageCostTimeline: StorageCostPoint[] = [];
  let storageCostTotal = 0;
  let lifetimeActionTotal = 0;
  let lifetimeStorageTotal = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const dayData = dailyMap.get(dateStr) || {
      creation: 0,
      collaboration: 0,
      delivery: 0,
      authentication: 0,
      analytics: 0,
      devmode: 0,
    };
    dailyCosts.push({
      date: dateStr,
      ...dayData,
    });

    const storageDay = storageDailyMap.get(dateStr) || { textBytes: 0, mediaBytes: 0, audioBytes: 0 };
    storageTimeline.push({
      date: dateStr,
      ...storageDay,
    });

    const costPoint: StorageCostPoint = {
      date: dateStr,
      textCost: calculateDailyStorageCost(storageDay.textBytes, "text"),
      mediaCost: calculateDailyStorageCost(storageDay.mediaBytes, "media"),
      audioCost: calculateDailyStorageCost(storageDay.audioBytes, "audio"),
    };
    storageCostTimeline.push(costPoint);
    storageCostTotals.text += costPoint.textCost;
    storageCostTotals.media += costPoint.mediaCost;
    storageCostTotals.audio += costPoint.audioCost;
    storageCostTotal += costPoint.textCost + costPoint.mediaCost + costPoint.audioCost;
    lifetimeStorageTotal += costPoint.textCost + costPoint.mediaCost + costPoint.audioCost;
    storageFootprint = {
      text: storageDay.textBytes,
      media: storageDay.mediaBytes,
      audio: storageDay.audioBytes,
    };

    if (storageDay.textBytes > 0) {
      storageLastMeasured.text = dateStr;
    }
    if (storageDay.mediaBytes > 0) {
      storageLastMeasured.media = dateStr;
    }
    if (storageDay.audioBytes > 0) {
      storageLastMeasured.audio = dateStr;
    }
  }

  // Build category breakdown
  const categoryBreakdown: CategoryBreakdown[] = [];
  for (const [category, data] of categoryTotals.entries()) {
    const meta = CATEGORY_METADATA[category];
    categoryBreakdown.push({
      category,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      actionCount: data.count,
      totalCost: data.cost,
      percentage: actionCostTotal > 0 ? (data.cost / actionCostTotal) * 100 : 0,
    });
  }
  categoryBreakdown.sort((a, b) => b.totalCost - a.totalCost);

  // Build top actions
  const actionCostDetails: ActionCostDetail[] = Array.from(actionDetailsMap.values()).map((detail) => {
    const stats = actionStats.get(detail.action);
    return {
      ...detail,
      lastOccurredAtIso: stats?.lastOccurredAt ? stats.lastOccurredAt.toISOString() : null,
    };
  });
  actionCostDetails.sort((a, b) => b.totalCost - a.totalCost);

  const topActions: TopAction[] = actionCostDetails
    .map((detail) => ({
      action: detail.action,
      label: ACTION_LABELS[detail.action] || detail.label,
      count: actionStats.get(detail.action)?.count ?? 0,
      totalCost: detail.totalCost,
      quantity: detail.quantity,
      unit: detail.unit,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const actionCategoryGroups: CategoryActionGroup[] = CATEGORY_ORDER.map((category) => {
    const meta = CATEGORY_METADATA[category];
    const actionsForCategory = costModelEntries
      .filter((entry) => entry.category === category)
      .map((entry) => actionCostDetails.find((detail) => detail.action === entry.action))
      .filter((detail): detail is ActionCostDetail => Boolean(detail));
    const totals = actionsForCategory.reduce(
      (acc, action) => {
        acc.quantity += action.quantity;
        acc.cost += action.totalCost;
        return acc;
      },
      { quantity: 0, cost: 0 },
    );

    return {
      category,
      label: meta.label,
      description: meta.description,
      color: meta.color,
      icon: meta.icon,
      totalQuantity: totals.quantity,
      totalCost: totals.cost,
      actions: actionsForCategory,
    };
  });

  const storageCategoryGroups: StorageCategoryGroup[] = STORAGE_CATEGORY_ORDER.map((category) => {
    const meta = STORAGE_CATEGORY_METADATA[category];
    return {
      category,
      label: meta.label,
      description: meta.description,
      color: meta.color,
      vendor: meta.vendor,
      unitLabel: meta.unitLabel,
      unitCost: meta.unitCost,
      totalBytes: storageFootprint[category],
      totalCost: storageCostTotals[category],
      lastMeasuredAtIso: storageLastMeasured[category],
      projections: calculateStorageProjections(category),
    };
  });

  const totalCost = actionCostTotal + storageCostTotal;
  lifetimeActionTotal = actionCostTotal;
  lifetimeStorageTotal = storageCostTotal;

  const lifetime: LifetimeUsageStats = {
    actionCost: lifetimeActionTotal,
    storageCost: lifetimeStorageTotal,
    storageFootprint,
    storageCostTotals,
  };

  return {
    dailyCosts,
    categoryBreakdown,
    topActions: topActions.slice(0, 10),
    totalCost,
    actionCostTotal,
    storageCostTotal,
    currentPeriodStartIso: startDate.toISOString(),
    currentPeriodEndIso: endDate.toISOString(),
    storageTimeline,
    storageFootprint,
    storageCostTimeline,
    storageCostTotals,
    lifetime,
    actionCostDetails,
    actionCategoryGroups,
    storageCategoryGroups,
  };
}
