"use client";

import { useMemo, useState } from "react";

import type { StorageCategory, UsageDashboardData } from "@/lib/usage/types";
import { STORAGE_CATEGORY_LABELS, STORAGE_CATEGORY_ORDER, formatBytes } from "@/lib/usage/storage";
import { formatUsageDayLabel } from "@/lib/utils/date";

import { UsageCategoryAccordions } from "./UsageCategoryAccordions";
import { InteractiveLineChart, type ChartDataPoint, type ChartSeries, type DateRange } from "./InteractiveLineChart";

function filterByRange<T extends { date: string }>(rows: T[], range: DateRange): T[] {
  if (range === "max" || rows.length === 0) return rows;
  const endDate = new Date(rows[rows.length - 1].date);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - range);
  return rows.filter((row) => new Date(row.date) >= startDate);
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

type UsageDashboardClientProps = {
  analytics: UsageDashboardData;
};

const CATEGORY_SERIES: ChartSeries[] = [
  { key: "creation", label: "Creation", color: "blue" },
  { key: "collaboration", label: "Collaboration", color: "purple" },
  { key: "devmode", label: "Dev Mode", color: "cyan" },
  { key: "authentication", label: "Authentication", color: "orange" },
  { key: "delivery", label: "Delivery", color: "emerald" },
  { key: "analytics", label: "Analytics", color: "pink" },
];

const STORAGE_SERIES: ChartSeries[] = [
  { key: "textBytes", label: STORAGE_CATEGORY_LABELS.text, color: "purple" },
  { key: "mediaBytes", label: STORAGE_CATEGORY_LABELS.media, color: "cyan" },
  { key: "audioBytes", label: STORAGE_CATEGORY_LABELS.audio, color: "orange" },
];

type ChartMode = "usage" | "storage";

export function UsageDashboardClient({ analytics }: UsageDashboardClientProps) {
  const {
    totalCost,
    actionCostTotal,
    storageCostTotal,
    dailyCosts,
    storageTimeline,
    storageFootprint,
    storageCostTimeline,
    storageCostTotals,
    actionCategoryGroups,
    storageCategoryGroups,
  } = analytics;

  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [chartMode, setChartMode] = useState<ChartMode>("usage");

  const usageChartData: ChartDataPoint[] = dailyCosts.map((row) => ({
    date: row.date,
    creation: row.creation,
    collaboration: row.collaboration,
    devmode: row.devmode,
    authentication: row.authentication,
    delivery: row.delivery,
    analytics: row.analytics,
  }));

  const storageChartData: ChartDataPoint[] = storageTimeline.map((row) => ({
    date: row.date,
    textBytes: row.textBytes,
    mediaBytes: row.mediaBytes,
    audioBytes: row.audioBytes,
  }));

  const usageRangeChartData = useMemo(() => filterByRange(usageChartData, dateRange), [usageChartData, dateRange]);
  const storageRangeCostData = useMemo(() => filterByRange(storageCostTimeline, dateRange), [storageCostTimeline, dateRange]);

  const activeCategories = useMemo(
    () => actionCategoryGroups.filter((group) => group.totalCost > 0).length,
    [actionCategoryGroups],
  );

  const rangeUsageTotal = useMemo(() => {
    return usageRangeChartData.reduce((sum, row) => {
      return (
        sum +
        (Number(row.creation) || 0) +
        (Number(row.collaboration) || 0) +
        (Number(row.devmode) || 0) +
        (Number(row.authentication) || 0) +
        (Number(row.delivery) || 0) +
        (Number(row.analytics) || 0)
      );
    }, 0);
  }, [usageRangeChartData]);

  const formatCost = (value: number) => {
    if (value === 0) return "$0.00";
    if (value < 0.01) return currencyFormatter.format(value);
    return `$${value.toFixed(2)}`;
  };

  const storageRangeCost = useMemo(() => {
    return storageRangeCostData.reduce((sum, row) => sum + row.textCost + row.mediaCost + row.audioCost, 0);
  }, [storageRangeCostData]);

  const storageRangeTotalsByCategory = useMemo<Record<StorageCategory, number>>(() => {
    return storageRangeCostData.reduce(
      (acc, row) => {
        acc.text += row.textCost;
        acc.media += row.mediaCost;
        acc.audio += row.audioCost;
        return acc;
      },
      { text: 0, media: 0, audio: 0 },
    );
  }, [storageRangeCostData]);

  const combinedRangeCost = rangeUsageTotal + storageRangeCost;

  const formatDate = (dateStr: string) => formatUsageDayLabel(dateStr);

  const activeChart = chartMode === "usage"
    ? { data: usageChartData, series: CATEGORY_SERIES, formatValue: formatCost }
    : { data: storageChartData, series: STORAGE_SERIES, formatValue: formatBytes };

  const rangeLabelLong = dateRange === "max" ? "entire history" : `past ${dateRange} days`;
  const rangeHeadingLabel = dateRange === "max" ? "Entire history" : `Last ${dateRange} days`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="text-center">
          <h1 className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            Usage Analytics
          </h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">Track your action and storage spend in one view.</p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="inline-flex flex-col items-center gap-1 rounded-3xl border border-white/50 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-800 shadow-md dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100">
              <span className="text-3xl font-bold">{formatCost(combinedRangeCost)}</span>
              <span>{rangeLabelLong}</span>
            </span>
            {activeCategories > 0 && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {activeCategories} {activeCategories === 1 ? "category" : "categories"} active
              </p>
            )}
          </div>
        </div>

        {totalCost > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{rangeHeadingLabel}</p>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {chartMode === "usage" ? "Usage spend" : "Storage footprint"}
                </h2>
              </div>
              <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900">
                {([
                  { label: "Usage", value: "usage" },
                  { label: "Storage", value: "storage" },
                ] as const).map((option) => {
                  const isActive = chartMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setChartMode(option.value)}
                      className={`rounded-full px-4 py-1 transition ${
                        isActive
                          ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <InteractiveLineChart
              data={activeChart.data}
              series={activeChart.series}
              height={500}
              formatValue={activeChart.formatValue}
              formatDate={formatDate}
              dateRange={dateRange}
              onRangeChange={setDateRange}
            />

            {chartMode === "storage" && (
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {STORAGE_CATEGORY_ORDER.map((category) => (
                  <div
                    key={category}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      {STORAGE_CATEGORY_LABELS[category]}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {formatBytes(storageFootprint[category] ?? 0)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Range: {formatCost(storageRangeTotalsByCategory[category] ?? 0)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lifetime: {formatCost(storageCostTotals[category] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-12 text-center shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="mb-4 text-6xl">📊</div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">No usage data yet</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Start creating ideas, features, and collaborating to see your usage analytics here!
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-card p-6 text-card-foreground dark:border-slate-700 dark:bg-slate-900">
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Actions</p>
              <p className="text-2xl font-bold text-card-foreground">{formatCost(actionCostTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Storage</p>
              <p className="text-2xl font-bold text-card-foreground">{formatCost(storageCostTotal)}</p>
            </div>
          </div>
        </div>

        <UsageCategoryAccordions
          actionGroups={actionCategoryGroups}
          storageGroups={storageCategoryGroups}
          formatCost={formatCost}
        />

        <p className="text-center text-xs text-slate-500 dark:text-slate-300">
          Evaluation mode: We’re tracking activity patterns to optimize our cost model before launching billing.
        </p>
      </div>
    </div>
  );
}
