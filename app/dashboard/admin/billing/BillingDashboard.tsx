"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CreditBalanceRow, UsageAggregate } from "./actions";
import { grantCreditsAction } from "./actions";

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type BillingDashboardProps = {
  usageAggregates: UsageAggregate[];
  creditBalances: CreditBalanceRow[];
};

type GrantFormState = {
  payerType: "user" | "workspace";
  payerId: string;
  amount: string;
  note: string;
};

const INITIAL_FORM: GrantFormState = {
  payerType: "user",
  payerId: "",
  amount: "100",
  note: "Admin top-up",
};

export function BillingDashboard({ usageAggregates, creditBalances }: BillingDashboardProps) {
  const [form, setForm] = useState<GrantFormState>(INITIAL_FORM);
  const [isGranting, startTransition] = useTransition();

  const handleGrant = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error("Provide a non-zero amount of credits to grant.");
      return;
    }
    if (!form.payerId.trim()) {
      toast.error("Provide a payer ID (user id or workspace id).");
      return;
    }

    startTransition(async () => {
      try {
        await grantCreditsAction({
          payerType: form.payerType,
          payerId: form.payerId.trim(),
          amount,
          note: form.note.trim() || undefined,
        });
        toast.success("Credits updated");
        setForm((prev) => ({ ...prev, amount: "100" }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to grant credits");
      }
    });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Usage by payer</h2>
          <p className="text-xs text-muted-foreground">Approximate spend grouped by payer based on usage ledger.</p>
        </div>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Payer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Total cost</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {usageAggregates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No usage records yet.
                    </td>
                  </tr>
                ) : (
                  usageAggregates.map((row) => (
                    <tr key={`${row.payerType}:${row.payerId}`}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {row.email || row.payerId}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.payerType}</td>
                      <td className="px-4 py-3">{currencyFormatter.format(row.totalCost)}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.totalQuantity)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {row.lastOccurredAt ? row.lastOccurredAt.toLocaleString() : "–"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Credit balances</h2>
          <p className="text-xs text-muted-foreground">Review remaining credits and manual grants.</p>
        </div>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Payer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">On hold</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {creditBalances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No balances yet.
                    </td>
                  </tr>
                ) : (
                  creditBalances.map((row) => (
                    <tr key={`${row.payerType}:${row.payerId}`}>
                      <td className="px-4 py-3 font-medium text-foreground">{row.email || row.payerId}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.payerType}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.available)}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.onHold)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.updatedAt.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Grant credits</h2>
          <p className="text-xs text-muted-foreground">Add or remove credits manually when helping a customer.</p>
        </div>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payer type</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={form.payerType === "user" ? "default" : "outline"}
                    onClick={() => setForm((prev) => ({ ...prev, payerType: "user" }))}
                    size="sm"
                    disabled={isGranting}
                  >
                    User
                  </Button>
                  <Button
                    type="button"
                    variant={form.payerType === "workspace" ? "default" : "outline"}
                    onClick={() => setForm((prev) => ({ ...prev, payerType: "workspace" }))}
                    size="sm"
                    disabled={isGranting}
                  >
                    Workspace
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payer ID</label>
                <Input
                  value={form.payerId}
                  onChange={(event) => setForm((prev) => ({ ...prev, payerId: event.target.value }))}
                  placeholder="UUID or workspace slug"
                  disabled={isGranting}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credits</label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  disabled={isGranting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin note</label>
                <Textarea
                  rows={3}
                  value={form.note}
                  onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                  disabled={isGranting}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleGrant} disabled={isGranting}>
                {isGranting ? "Granting…" : "Grant credits"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
