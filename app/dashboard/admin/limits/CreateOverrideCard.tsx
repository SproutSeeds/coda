"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LIMIT_METRICS } from "@/lib/limits/types";

import { createManualLimitOverrideAction } from "./actions";

type ScopeType = "user" | "idea" | "org";

type FormState = {
  scopeType: ScopeType;
  scopeId: string;
  metric: string;
  limitValue: string;
  planId: string;
  expiresAt: string;
  reason: string;
  resolutionNote: string;
  status: "approved" | "rejected";
};

const DEFAULT_STATE: FormState = {
  scopeType: "user",
  scopeId: "",
  metric: LIMIT_METRICS[0],
  limitValue: "",
  planId: "",
  expiresAt: "",
  reason: "",
  resolutionNote: "",
  status: "approved",
};

export function CreateOverrideCard() {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_STATE });
  const [isPending, startTransition] = useTransition();

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = () => {
    const limitValue = Number(form.limitValue);
    if (!Number.isFinite(limitValue) || limitValue <= 0) {
      toast.error("Provide a positive limit value.");
      return;
    }
    const scopeId = form.scopeId.trim();
    if (!scopeId) {
      toast.error("Scope ID is required (must be a UUID).");
      return;
    }

    startTransition(async () => {
      try {
        await createManualLimitOverrideAction({
          scopeType: form.scopeType,
          scopeId,
          metric: form.metric,
          limitValue,
          planId: form.planId ? form.planId.trim() : null,
          reason: form.reason ? form.reason : null,
          resolutionNote: form.resolutionNote ? form.resolutionNote : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          status: form.status,
        });

        toast.success("Override created", {
          description: `${form.metric} for ${form.scopeType}:${scopeId}`,
        });
        setForm({ ...DEFAULT_STATE });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create override";
        toast.error(message);
      }
    });
  };

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="text-sm font-semibold text-foreground">Create manual override</CardTitle>
        <p className="text-xs text-muted-foreground">
          Apply a manual limit adjustment. Approved overrides start immediately; rejected requests will clear out of queues.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scope type</label>
            <select
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={form.scopeType}
              onChange={handleChange("scopeType")}
              disabled={isPending}
            >
              <option value="user">User</option>
              <option value="idea">Idea</option>
              <option value="org">Org</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scope ID</label>
            <Input
              placeholder="UUID"
              value={form.scopeId}
              onChange={handleChange("scopeId")}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metric</label>
            <select
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={form.metric}
              onChange={handleChange("metric")}
              disabled={isPending}
            >
              {LIMIT_METRICS.map((metric) => (
                <option key={metric} value={metric}>
                  {metric}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Limit value</label>
            <Input
              type="number"
              min={0}
              value={form.limitValue}
              onChange={handleChange("limitValue")}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan (optional)</label>
            <Input
              placeholder="plan id"
              value={form.planId}
              onChange={handleChange("planId")}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expires (optional)</label>
            <Input
              type="datetime-local"
              value={form.expiresAt}
              onChange={handleChange("expiresAt")}
              disabled={isPending}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason</label>
            <Textarea
              rows={3}
              placeholder="Optional audit note"
              value={form.reason}
              onChange={handleChange("reason")}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolution note</label>
            <Textarea
              rows={3}
              placeholder="Optional message back to requester"
              value={form.resolutionNote}
              onChange={handleChange("resolutionNote")}
              disabled={isPending}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <label htmlFor="override-status" className="font-semibold uppercase tracking-wide">Status</label>
            <select
              id="override-status"
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={form.status}
              onChange={handleChange("status")}
              disabled={isPending}
            >
              <option value="approved">Approve immediately</option>
              <option value="rejected">Mark as rejected</option>
            </select>
          </div>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Create override"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
