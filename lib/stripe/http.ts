import "server-only";

import { stripeEnv } from "./config";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

async function parseStripeResponse<T>(response: Response, path: string): Promise<T> {
  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Stripe API response parsing failed for ${path}: ${(error as Error).message}`);
  }

  if (!response.ok) {
    let errorMessage = `Stripe API error (${response.status})`;
    if (parsed && typeof parsed === "object") {
      const maybeError = (parsed as { error?: { message?: unknown } }).error;
      if (maybeError && typeof maybeError.message === "string") {
        errorMessage = maybeError.message;
      }
    }
    throw new Error(errorMessage);
  }

  return parsed as T;
}

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  customer?: string | null;
  subscription?: string | null;
};

export type StripeCustomer = {
  id: string;
  email?: string | null;
  metadata?: Record<string, string>;
};

export async function stripePost<TResponse = unknown>(path: string, body: URLSearchParams, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeEnv.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    ...init,
  });

  return parseStripeResponse<TResponse>(response, path);
}

export async function stripeGet<TResponse = unknown>(path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripeEnv.secretKey}`,
    },
    cache: "no-store",
    ...init,
  });

  return parseStripeResponse<TResponse>(response, path);
}
