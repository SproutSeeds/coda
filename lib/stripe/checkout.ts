import "server-only";

import { stripePost, type StripeCheckoutSession } from "./http";

type CheckoutMode = "payment" | "subscription";

export type CreateCheckoutSessionOptions = {
  priceId: string;
  mode: CheckoutMode;
  quantity?: number;
  customerId?: string | null;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
  subscriptionMetadata?: Record<string, string>;
  allowPromotionCodes?: boolean;
  successUrl: string;
  cancelUrl: string;
};

export async function createCheckoutSession(options: CreateCheckoutSessionOptions) {
  const body = new URLSearchParams();
  body.set("mode", options.mode);
  body.set("success_url", options.successUrl);
  body.set("cancel_url", options.cancelUrl);
  body.set("line_items[0][price]", options.priceId);
  body.set("line_items[0][quantity]", String(options.quantity ?? 1));

  if (options.customerId) {
    body.set("customer", options.customerId);
  } else if (options.customerEmail) {
    body.set("customer_email", options.customerEmail);
  }

  if (options.allowPromotionCodes) {
    body.set("allow_promotion_codes", "true");
  }

  if (options.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      if (value != null) {
        body.set(`metadata[${key}]`, String(value));
      }
    }
  }

  if (options.subscriptionMetadata && options.mode === "subscription") {
    for (const [key, value] of Object.entries(options.subscriptionMetadata)) {
      if (value != null) {
        body.set(`subscription_data[metadata][${key}]`, String(value));
      }
    }
  }

  return stripePost<StripeCheckoutSession>("/checkout/sessions", body);
}
