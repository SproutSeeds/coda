"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

import type { ImportDecisionAction, ImportIdeaRow } from "./hooks/useImportIdeas";
import type { ImportIdeasPreviewResponse } from "@/app/dashboard/ideas/actions/import";

interface ImportIdeasDialogProps {
  open: boolean;
  summary: ImportIdeasPreviewResponse["diff"] | null;
  rows: ImportIdeaRow[];
  decisions: Map<string, ImportDecisionAction>;
  applyToAllAction: ImportDecisionAction | null;
  onDecisionChange: (normalizedTitle: string, action: ImportDecisionAction, options?: { applyToAll?: boolean }) => void;
  onClearApplyToAll: () => void;
  onConfirm: () => void;
  onClose: () => void;
  isCommitting: boolean;
}

const formatStat = (value: number) => value.toLocaleString();

export function ImportIdeasDialog({
  open,
  summary,
  rows,
  decisions,
  applyToAllAction,
  onDecisionChange,
  onClearApplyToAll,
  onConfirm,
  onClose,
  isCommitting,
}: ImportIdeasDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open || !summary) {
    return null;
  }

  const conflictCount = rows.filter((row) => row.hasConflict).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        data-testid="import-dialog"
        className="relative z-50 w-full max-w-3xl rounded-2xl border border-border/60 bg-card/80 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="import-dialog-title" className="text-lg font-semibold">
              Review import summary
            </h3>
            <p className="text-sm text-muted-foreground">
              Confirm the changes below. Duplicates can be updated or imported as new ideas.
            </p>
          </div>
          <Button variant="ghost" className="interactive-btn" onClick={onClose} disabled={isCommitting}>
            Cancel
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="New ideas" value={summary.newIdeas} testId="import-summary-new-ideas" />
          <Stat label="Updated ideas" value={summary.updatedIdeas} testId="import-summary-updated-ideas" />
          <Stat label="New features" value={summary.newFeatures} testId="import-summary-new-features" />
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                {rows.length} idea{rows.length === 1 ? "" : "s"} in this import.
                {" "}
                {conflictCount > 0
                  ? `${conflictCount} duplicate title${conflictCount === 1 ? "" : "s"} detected.`
                  : "All ideas will be created as new entries."}
              </p>
              {applyToAllAction ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="interactive-btn h-8 text-xs"
                  onClick={onClearApplyToAll}
                  disabled={isCommitting}
                >
                  Clear apply-to-all
                </Button>
              ) : null}
            </div>
            <div className="space-y-4">
              {rows.map((row) => {
                const selected = applyToAllAction ?? decisions.get(row.normalizedTitle) ?? (row.hasConflict ? "update" : "create-new");
                const canUpdate = row.hasConflict;

                return (
                  <div
                    key={row.normalizedTitle}
                    className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm"
                    data-testid="import-idea-row"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="text-sm font-semibold">{row.ideaTitle}</p>
                          {row.hasConflict ? (
                            <p className="text-xs text-muted-foreground">Existing idea ID: {row.existingIdeaId}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">No existing match detected</p>
                          )}
                        </div>
                        {row.warnings.length > 0 && selected === "update" ? (
                          <button
                            type="button"
                            className="group relative mt-0.5 text-amber-500 focus:outline-none"
                            aria-label={`Import warnings for ${row.ideaTitle}`}
                          >
                            <AlertTriangle className="size-4" />
                            <div className="pointer-events-none absolute left-1/2 top-full z-50 hidden w-72 -translate-x-1/2 translate-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-start text-xs text-amber-900 shadow-lg group-hover:flex group-focus-visible:flex">
                              <div className="flex flex-col gap-1">
                                {row.warnings.map((warning) => (
                                  <span key={warning}>{warning}</span>
                                ))}
                              </div>
                            </div>
                          </button>
                        ) : null}
                      </div>
                        <div className="flex items-center gap-2" role="radiogroup" aria-label={`Import decision for ${row.ideaTitle}`}>
                        <DecisionOption
                          label="Update existing"
                          active={selected === "update"}
                          onClick={() => onDecisionChange(row.normalizedTitle, "update")}
                          disabled={!canUpdate || isCommitting}
                        />
                          <DecisionOption
                            label="Create new"
                            active={selected === "create-new"}
                            onClick={() => onDecisionChange(row.normalizedTitle, "create-new")}
                            disabled={isCommitting}
                          />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="interactive-btn h-8 text-xs"
                          onClick={() => onDecisionChange(row.normalizedTitle, selected, { applyToAll: true })}
                          disabled={isCommitting}
                        >
                          Apply to all
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="interactive-btn"
            onClick={onClose}
            disabled={isCommitting}
          >
            Back
          </Button>
          <Button
            type="button"
            className="interactive-btn"
            onClick={onConfirm}
            disabled={isCommitting}
          >
            {isCommitting ? "Importing…" : "Import ideas"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm" data-testid={testId}>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{formatStat(value)}</p>
    </div>
  );
}

function DecisionOption({ label, active, onClick, disabled }: DecisionOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition",
        "border-border/60 text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-foreground",
        active && "border-primary bg-primary/10 text-foreground",
        disabled && "opacity-60 hover:border-border/60 hover:bg-transparent hover:text-muted-foreground",
      )}
      role="radio"
      aria-checked={active}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full border",
          active ? "border-primary bg-primary" : "border-border/60 bg-background",
        )}
        aria-hidden="true"
      >
        <span className={cn("h-2 w-2 rounded-full", active ? "bg-primary-foreground" : "bg-transparent")} />
      </span>
      {label}
    </button>
  );
}

interface DecisionOptionProps {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}
