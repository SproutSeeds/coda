"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CategoryActionGroup, StorageCategoryGroup, ActionCostDetail } from "@/lib/usage/types";
import { formatBytes } from "@/lib/usage/storage";
import { formatUsageDayLabel } from "@/lib/utils/date";
import {
  ChevronDown,
  Sparkles,
  Users,
  Send,
  Mail,
  LineChart,
  Terminal,
  Database,
  Archive,
} from "lucide-react";

import { ProjectionChips } from "./components/ProjectionChips";
import { UsageCostTooltip } from "./components/UsageCostTooltip";

type UsageCategoryAccordionsProps = {
  actionGroups: CategoryActionGroup[];
  storageGroups: StorageCategoryGroup[];
  formatCost: (value: number) => string;
};

const ICON_MAP = {
  Sparkles,
  Users,
  Send,
  Mail,
  LineChart,
  Terminal,
  Database,
  Archive,
} as const;

const COLOR_HEX: Record<string, string> = {
  blue: "#3b82f6",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#f97316",
  green: "#22c55e",
  emerald: "#10b981",
  pink: "#ec4899",
  indigo: "#6366f1",
  rose: "#f43f5e",
  amber: "#f59e0b",
  teal: "#14b8a6",
  slate: "#475569",
};

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function formatQuantity(detail: ActionCostDetail): string {
  if (detail.unit === "bytes") {
    return formatBytes(detail.quantity);
  }
  const formatted = numberFormatter.format(detail.quantity ?? 0);
  return detail.unitLabel ? `${formatted} ${detail.unitLabel}` : `${formatted} ${detail.unit}`;
}

function formatUnitCost(detail: ActionCostDetail, formatCost: (value: number) => string): string {
  if (!detail.unitCost) {
    return "Unit cost unavailable";
  }
  const label = detail.unitLabel ?? detail.unit;
  return `${formatCost(detail.unitCost)} per ${label}`;
}

type AccordionPanel = {
  id: string;
  title: string;
  description: string;
  color: string;
  icon: keyof typeof ICON_MAP;
  totalCost: number;
  content: ReactNode;
};

function ActionRow({
  detail,
  color,
  formatCost,
}: {
  detail: ActionCostDetail;
  color: string;
  formatCost: (value: number) => string;
}) {
  const quantity = formatQuantity(detail);
  const unitCostLabel = formatUnitCost(detail, formatCost);
  const lastUsed = detail.lastOccurredAtIso ? formatUsageDayLabel(detail.lastOccurredAtIso) : "No usage yet";

  return (
    <div
      key={detail.action}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-3">
          <span
            className="mt-1 inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: COLOR_HEX[color] ?? color }}
            aria-hidden="true"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900 dark:text-slate-50">{detail.label}</p>
              <UsageCostTooltip
                label={detail.label}
                vendor={detail.vendor}
                description={detail.description}
                unitCostLabel={unitCostLabel}
                projections={detail.projections}
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">{detail.description}</p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{unitCostLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCost(detail.totalCost)}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{quantity}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
        <span>Last used: {lastUsed}</span>
        <ProjectionChips projections={detail.projections} />
      </div>
    </div>
  );
}

function StorageRow({
  group,
  formatCost,
}: {
  group: StorageCategoryGroup;
  formatCost: (value: number) => string;
}) {
  const quantity = formatBytes(group.totalBytes ?? 0);
  const unitCostLabel = group.unitCost ? `${formatCost(group.unitCost)} per ${group.unitLabel}` : "Unit cost unavailable";
  const lastMeasured = group.lastMeasuredAtIso ? formatUsageDayLabel(group.lastMeasuredAtIso) : "No storage recorded";

  return (
    <div
      key={group.category}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1 inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: COLOR_HEX[group.color] ?? group.color }}
          aria-hidden="true"
        />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-50">{group.label}</p>
            <UsageCostTooltip
              label={group.label}
              vendor={group.vendor}
              description={group.description}
              unitCostLabel={unitCostLabel}
              projections={group.projections}
            />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">{group.description}</p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{unitCostLabel}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCost(group.totalCost)}</p>
          <p className="text-xs">{quantity} stored</p>
        </div>
        <div className="text-right text-xs">
          <p>Last measured: {lastMeasured}</p>
          <ProjectionChips projections={group.projections} />
        </div>
      </div>
    </div>
  );
}

export function UsageCategoryAccordions({ actionGroups, storageGroups, formatCost }: UsageCategoryAccordionsProps) {
  const accordionPanels: AccordionPanel[] = useMemo(() => {
    const actionPanels = actionGroups.map((group) => ({
      id: `action-${group.category}`,
      title: group.label,
      description: group.description,
      color: group.color,
      icon: (group.icon as keyof typeof ICON_MAP) || "Sparkles",
      totalCost: group.totalCost,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-200">{group.description}</p>
          {group.actions.length > 0 ? (
            group.actions.map((action) => (
              <ActionRow key={action.action} detail={action} color={group.color} formatCost={formatCost} />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              No tracked actions yet. As soon as you create activity in this category, we’ll itemize spend here using the exact vendor rates.
            </p>
          )}
        </div>
      ),
    }));

    const storagePanels = storageGroups.map((group) => ({
      id: `storage-${group.category}`,
      title: group.label,
      description: group.description,
      color: group.color,
      icon: "Archive" as const,
      totalCost: group.totalCost,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-200">{group.description}</p>
          <StorageRow group={group} formatCost={formatCost} />
        </div>
      ),
    }));

    return [...actionPanels, ...storagePanels];
  }, [actionGroups, storageGroups, formatCost]);

  const [openPanels, setOpenPanels] = useState(() => new Set<string>(accordionPanels.slice(0, 2).map((panel) => panel.id)));

  const togglePanel = (id: string) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {accordionPanels.map((panel) => {
        const IconComponent = ICON_MAP[panel.icon] ?? Sparkles;
        const isOpen = openPanels.has(panel.id);
        return (
          <div
            key={panel.id}
            className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
          >
            <button
              type="button"
              className="flex min-h-[4rem] w-full items-center justify-between gap-4 px-6 py-5 text-left text-card-foreground hover:bg-slate-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:hover:bg-slate-900/50 dark:focus-visible:outline-slate-300"
              aria-expanded={isOpen}
              aria-controls={`${panel.id}-content`}
              onClick={() => togglePanel(panel.id)}
            >
              <div className="flex flex-1 items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100/80 text-card-foreground dark:bg-slate-800/60">
                  <IconComponent
                    className="h-5 w-5"
                    style={{ color: COLOR_HEX[panel.color] ?? panel.color }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold text-card-foreground">{panel.title}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-card-foreground">{formatCost(panel.totalCost)}</p>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              id={`${panel.id}-content`}
              role="region"
              aria-hidden={!isOpen}
            className={`px-6 pb-6 transition-[max-height,opacity] duration-200 motion-reduce:transition-none motion-reduce:duration-0 ${
                isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 overflow-hidden opacity-0"
              }`}
            >
              {isOpen && <div className="pt-2">{panel.content}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
