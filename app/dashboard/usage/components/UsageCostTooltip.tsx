"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

import type { UsageCostBudget } from "@/lib/pricing/cost-model";
import type { StorageCostProjection } from "@/lib/usage/types";

import { ProjectionChips } from "./ProjectionChips";

type Projection = Pick<UsageCostBudget, "budgetUsd" | "summary"> | Pick<StorageCostProjection, "budgetUsd" | "summary">;

type UsageCostTooltipProps = {
  label: string;
  vendor?: string | null;
  description: string;
  unitCostLabel: string;
  projections?: Projection[] | null;
};

export function UsageCostTooltip({ label, vendor, description, unitCostLabel, projections }: UsageCostTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Show cost details for {label}</span>
      </button>

      {open && (
        <div
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none absolute right-0 top-8 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {vendor ?? "cloud cost"}
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{label}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
          <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{unitCostLabel}</p>
          <div className="mt-3">
            <ProjectionChips projections={projections} />
          </div>
        </div>
      )}
    </span>
  );
}
