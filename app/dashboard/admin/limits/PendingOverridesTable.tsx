"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resolveLimitOverrideAction } from "./actions";

export type SerializableOverride = {
  id: string;
  scopeType: string;
  scopeId: string;
  metric: string;
  limitValue: number;
  planId: string | null;
  reason: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
};

type PendingOverridesTableProps = {
  initialOverrides: SerializableOverride[];
};

type RowState = {
  limitValue: string;
  expiresAt: string;
  planId: string;
  resolutionNote: string;
};

function buildInitialRowState(override: SerializableOverride): RowState {
  return {
    limitValue: override.limitValue?.toString() ?? "",
    expiresAt: override.expiresAt ? new Date(override.expiresAt).toISOString().slice(0, 16) : "",
    planId: override.planId ?? "",
    resolutionNote: "",
  };
}

export function PendingOverridesTable({ initialOverrides }: PendingOverridesTableProps) {
  const [overrides, setOverrides] = useState(initialOverrides);
  const [rowState, setRowState] = useState<Record<string, RowState>>(() => {
    const entries = initialOverrides.map((override) => [override.id, buildInitialRowState(override)] as const);
    return Object.fromEntries(entries);
  });
  const [isPending, startTransition] = useTransition();

  const pendingCount = overrides.length;

  const handleDecision = (override: SerializableOverride, decision: "approve" | "reject") => {
    const state = rowState[override.id] ?? buildInitialRowState(override);
    const limitValueNumber = Number(state.limitValue);
    const expiresAtIso = state.expiresAt ? new Date(state.expiresAt).toISOString() : null;
    const planId = state.planId.trim() === "" ? null : state.planId.trim();
    const resolutionNote = state.resolutionNote.trim() === "" ? null : state.resolutionNote.trim();

    if (decision === "approve" && (!Number.isFinite(limitValueNumber) || limitValueNumber <= 0)) {
      toast.error("Provide a positive limit value before approving.");
      return;
    }

    startTransition(async () => {
      try {
        await resolveLimitOverrideAction({
          id: override.id,
          decision,
          limitValue: decision === "approve" ? limitValueNumber : undefined,
          expiresAt: expiresAtIso,
          planId,
          resolutionNote,
        });
        setOverrides((prev) => prev.filter((row) => row.id !== override.id));
        toast.success(decision === "approve" ? "Override approved" : "Override rejected", {
          description: `${override.metric} for ${override.scopeType}:${override.scopeId}`,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to resolve override");
      }
    });
  };

  const handleFieldChange = (id: string, field: keyof RowState, value: string) => {
    setRowState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? buildInitialRowState(overrides.find((o) => o.id === id)!)),
        [field]: value,
      },
    }));
  };

  const tableContent = useMemo(() => {
    if (overrides.length === 0) {
      return (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
          All caught up—no pending override requests.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {overrides.map((override) => {
          const state = rowState[override.id] ?? buildInitialRowState(override);
          return (
            <Card key={override.id} className="border-border/70 bg-card/95">
              <CardHeader className="flex flex-col gap-1">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {override.metric}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Scope: {override.scopeType} → {override.scopeId}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-foreground/90">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New limit</label>
                    <Input
                      type="number"
                      min={0}
                      value={state.limitValue}
                      onChange={(event) => handleFieldChange(override.id, "limitValue", event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expires</label>
                    <Input
                      type="datetime-local"
                      value={state.expiresAt}
                      onChange={(event) => handleFieldChange(override.id, "expiresAt", event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan</label>
                    <Input
                      placeholder="(optional) plan id"
                      value={state.planId}
                      onChange={(event) => handleFieldChange(override.id, "planId", event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolution note</label>
                  <Textarea
                    rows={3}
                    value={state.resolutionNote}
                    onChange={(event) => handleFieldChange(override.id, "resolutionNote", event.target.value)}
                    placeholder="Optional context for the requester"
                    disabled={isPending}
                  />
                </div>
                {override.reason ? (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Requester justification</p>
                    <p className="mt-1 whitespace-pre-wrap">{override.reason}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDecision(override, "reject")}
                    disabled={isPending}
                  >
                    Reject
                  </Button>
                  <Button onClick={() => handleDecision(override, "approve")}
                    disabled={isPending}
                  >
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }, [handleDecision, handleFieldChange, isPending, overrides, rowState]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Pending overrides ({pendingCount})</h2>
      </div>
      {tableContent}
    </div>
  );
}
