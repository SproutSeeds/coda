import "server-only";

import { stripeGet, stripePost } from "./http";

export type StripeSubscriptionItem = {
  id: string;
  price?: {
    id: string;
  } | null;
  // Period dates moved to item level in flexible billing mode
  current_period_end?: number | null;
  current_period_start?: number | null;
};

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  cancel_at?: number | null;
  canceled_at?: number | null;
  // Period dates may be at root level (legacy) or in items (flexible billing)
  current_period_end?: number | null;
  current_period_start?: number | null;
  pause_collection?: { behavior: string } | null;
  items: {
    data: StripeSubscriptionItem[];
  };
};

/**
 * Get current period end from subscription, checking items first (flexible billing) then root (legacy)
 */
export function getSubscriptionPeriodEnd(sub: StripeSubscription): number | null {
  return sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null;
}

/**
 * Get current period start from subscription, checking items first (flexible billing) then root (legacy)
 */
export function getSubscriptionPeriodStart(sub: StripeSubscription): number | null {
  return sub.items?.data?.[0]?.current_period_start ?? sub.current_period_start ?? null;
}

export async function getStripeSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeGet<StripeSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function setSubscriptionCancellation(options: { subscriptionId: string; cancelAtPeriodEnd: boolean }): Promise<StripeSubscription> {
  const body = new URLSearchParams();
  body.set("cancel_at_period_end", options.cancelAtPeriodEnd ? "true" : "false");
  return stripePost<StripeSubscription>(`/subscriptions/${options.subscriptionId}`, body);
}

export type StripeInvoicePreview = {
  amount_due: number;
  currency: string;
  lines: {
    data: Array<{
      id: string;
      amount: number;
      description?: string | null;
      proration?: boolean | null;
    }>;
  };
};

export async function previewSubscriptionUpgradeInvoice(options: {
  customerId: string;
  subscriptionId: string;
  subscriptionItemId: string;
  newPriceId: string;
}): Promise<StripeInvoicePreview> {
  const params = new URLSearchParams();
  params.set("customer", options.customerId);
  params.set("subscription", options.subscriptionId);
  params.set("subscription_items[0][id]", options.subscriptionItemId);
  params.set("subscription_items[0][price]", options.newPriceId);
  params.set("subscription_items[0][quantity]", "1");
  return stripeGet<StripeInvoicePreview>(`/invoices/upcoming?${params.toString()}`);
}

export async function upgradeSubscriptionPlan(options: {
  subscriptionId: string;
  subscriptionItemId: string;
  newPriceId: string;
  metadata?: Record<string, string>;
}) {
  const body = new URLSearchParams();
  body.set("items[0][id]", options.subscriptionItemId);
  body.set("items[0][price]", options.newPriceId);
  body.set("items[0][quantity]", "1");
  body.set("proration_behavior", "create_prorations");
  
  if (options.metadata) {
    Object.entries(options.metadata).forEach(([key, value]) => {
      body.set(`metadata[${key}]`, value);
    });
  }

  return stripePost<StripeSubscription>(`/subscriptions/${options.subscriptionId}`, body);
}

export type StripeSubscriptionSchedule = {
  id: string;
  customer: string;
  subscription: string;
  status: string;
  phases: Array<{
    start_date: number;
    end_date: number;
    items: Array<{
      price: string;
      quantity: number;
    }>;
  }>;
};

export async function listSubscriptionSchedules(options: { customerId: string }): Promise<{ data: StripeSubscriptionSchedule[] }> {
  const params = new URLSearchParams();
  params.set("customer", options.customerId);
  // Only get active or scheduled ones
  params.set("limit", "3"); 
  return stripeGet<{ data: StripeSubscriptionSchedule[] }>(`/subscription_schedules?${params.toString()}`);
}

export async function createFutureSubscriptionSchedule(options: {
  customerId: string;
  priceId: string;
  startDate: number;
  metadata?: Record<string, string>;
}) {
  const body = new URLSearchParams();
  body.set("customer", options.customerId);
  body.set("start_date", options.startDate.toString());
  body.set("phases[0][items][0][price]", options.priceId);
  body.set("phases[0][items][0][quantity]", "1");

  // Set behavior to charge immediately when the phase starts
  body.set("phases[0][proration_behavior]", "none");

  if (options.metadata) {
     // Schedule metadata
    Object.entries(options.metadata).forEach(([key, value]) => {
      body.set(`metadata[${key}]`, value);
    });
    // Phase metadata (often propagates to subscription)
    Object.entries(options.metadata).forEach(([key, value]) => {
        body.set(`phases[0][metadata][${key}]`, value);
    });
  }

  return stripePost<any>("/subscription_schedules", body);
}

/**
 * Cancel a subscription schedule (e.g., a scheduled annual upgrade).
 * This cancels the schedule, meaning the subscription will continue on its current plan
 * instead of switching to the scheduled annual plan.
 */
export async function cancelSubscriptionSchedule(scheduleId: string): Promise<StripeSubscriptionSchedule> {
  // The cancel endpoint doesn't take any parameters - it just cancels the schedule
  return stripePost<StripeSubscriptionSchedule>(`/subscription_schedules/${scheduleId}/cancel`, new URLSearchParams());
}

/**
 * Get a specific subscription schedule by ID
 */
export async function getSubscriptionSchedule(scheduleId: string): Promise<StripeSubscriptionSchedule> {
  return stripeGet<StripeSubscriptionSchedule>(`/subscription_schedules/${scheduleId}`);
}

/**
 * Find an active or scheduled upgrade schedule for a customer
 */
export async function findScheduledUpgrade(options: {
  customerId: string;
  annualPriceId: string;
}): Promise<StripeSubscriptionSchedule | null> {
  const schedules = await listSubscriptionSchedules({ customerId: options.customerId });
  return schedules.data.find((s) =>
    (s.status === "not_started" || s.status === "active") &&
    s.phases.some((p) => p.items.some((i) => i.price === options.annualPriceId))
  ) ?? null;
}
