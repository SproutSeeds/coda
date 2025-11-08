"use client";

import type { UsageCostBudget } from "@/lib/pricing/cost-model";
import type { StorageCostProjection } from "@/lib/usage/types";

type Projection = Pick<UsageCostBudget, "budgetUsd" | "summary"> | Pick<StorageCostProjection, "budgetUsd" | "summary">;

type ProjectionChipsProps = {
  projections?: Projection[] | null;
  className?: string;
};

export function ProjectionChips({ projections, className }: ProjectionChipsProps) {
  if (!projections || projections.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {projections.map((projection) => (
        <span
          key={`${projection.budgetUsd}-${projection.summary}`}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {projection.summary}
        </span>
      ))}
    </div>
  );
}
