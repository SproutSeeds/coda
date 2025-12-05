"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PLAN_IDS, PRICING } from "@/lib/plans/constants";
import { ensureStripeCustomer } from "@/lib/stripe/customers";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { stripeEnv } from "@/lib/stripe/config";
import { selectPath } from "@/lib/journey/progress";
import type { ChosenPath } from "@/lib/journey/types";

const SUCCESS_PATH = "/dashboard/quest-hub?checkout=success";
const CANCEL_PATH = "/choose-path?checkout=cancelled";

function buildReturnUrl(path: string) {
  const base = stripeEnv.appBaseUrl.replace(/\/$/, "");
  return `${base}${path}`;
}

async function getStripeCustomerId(userId: string) {
  const db = getDb();
  const [record] = await db
    .select({ id: users.id, stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!record) {
    throw new Error("User not found for checkout session.");
  }

  if (record.stripeCustomerId) {
    return record.stripeCustomerId;
  }

  return ensureStripeCustomer(userId, { db });
}

/**
 * Select path action - unified handler for both Wanderer and Sorcerer paths
 */
export async function selectPathAction(
  path: ChosenPath,
  billingPeriod?: "monthly" | "annual"
): Promise<{ success: boolean; checkoutUrl?: string; message?: string }> {
  const user = await requireUser();
  const db = getDb();

  // Check if user already has a path chosen
  const [record] = await db
    .select({ chosenPath: users.chosenPath, planId: users.planId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (record?.chosenPath) {
    // User already chose a path, redirect to their journey
    return { success: true, message: "Path already chosen" };
  }

  if (path === "wanderer") {
    // Select wanderer path and initialize journey
    await selectPath(user.id, "wanderer");
    return { success: true, message: "Welcome, Wanderer. Your journey begins." };
  }

  // For sorcerer, we need to create Stripe checkout
  const period = billingPeriod ?? "monthly";
  const priceId = period === "monthly"
    ? PRICING.monthly.stripePriceId
    : PRICING.annual.stripePriceId;

  if (!priceId) {
    throw new Error(`Stripe price ID not configured for ${period} plan`);
  }

  // Mark path as sorcerer (will be finalized on successful payment)
  await selectPath(user.id, "sorcerer");

  const customerId = await getStripeCustomerId(user.id);

  const session = await createCheckoutSession({
    priceId,
    mode: "subscription",
    customerId,
    successUrl: buildReturnUrl(SUCCESS_PATH),
    cancelUrl: buildReturnUrl(CANCEL_PATH),
    allowPromotionCodes: true,
    metadata: {
      user_id: user.id,
      plan_id: period === "monthly" ? PLAN_IDS.SORCERER_MONTHLY : PLAN_IDS.SORCERER_ANNUAL,
    },
    subscriptionMetadata: {
      user_id: user.id,
      plan_id: period === "monthly" ? PLAN_IDS.SORCERER_MONTHLY : PLAN_IDS.SORCERER_ANNUAL,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { success: true, checkoutUrl: session.url };
}

/**
 * Start the Wanderer's Path - Free trial
 * @deprecated Use selectPathAction("wanderer") instead
 */
export async function startGauntletAction(_formData?: FormData) {
  void _formData;
  const user = await requireUser();
  const db = getDb();

  // Check if user already has a path
  const [record] = await db
    .select({ chosenPath: users.chosenPath, planId: users.planId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (record?.chosenPath || record?.planId) {
    revalidatePath("/choose-path");
    revalidatePath("/dashboard/quest-hub");
    redirect("/dashboard/quest-hub");
  }

  // Select wanderer path
  await selectPath(user.id, "wanderer");

  // Revalidate both pages to clear cache
  revalidatePath("/choose-path");
  revalidatePath("/dashboard/quest-hub");

  // Redirect to the quest hub
  redirect("/dashboard/quest-hub");
}

/**
 * Subscribe to Sorcerer Monthly ($25/mo)
 * Redirects to Stripe Checkout
 */
export async function selectSorcererMonthlyAction(_formData?: FormData) {
  void _formData;
  const user = await requireUser();

  const priceId = PRICING.monthly.stripePriceId;
  if (!priceId) {
    throw new Error("Stripe price ID not configured for monthly plan");
  }

  const customerId = await getStripeCustomerId(user.id);

  const session = await createCheckoutSession({
    priceId,
    mode: "subscription",
    customerId,
    successUrl: buildReturnUrl(SUCCESS_PATH),
    cancelUrl: buildReturnUrl(CANCEL_PATH),
    allowPromotionCodes: true,
    metadata: {
      user_id: user.id,
      plan_id: PLAN_IDS.SORCERER_MONTHLY,
    },
    subscriptionMetadata: {
      user_id: user.id,
      plan_id: PLAN_IDS.SORCERER_MONTHLY,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}

/**
 * Subscribe to Sorcerer Annual ($240/yr = $20/mo)
 * Redirects to Stripe Checkout
 */
export async function selectSorcererAnnualAction(_formData?: FormData) {
  void _formData;
  const user = await requireUser();

  const priceId = PRICING.annual.stripePriceId;
  if (!priceId) {
    throw new Error("Stripe price ID not configured for annual plan");
  }

  const customerId = await getStripeCustomerId(user.id);

  const session = await createCheckoutSession({
    priceId,
    mode: "subscription",
    customerId,
    successUrl: buildReturnUrl(SUCCESS_PATH),
    cancelUrl: buildReturnUrl(CANCEL_PATH),
    allowPromotionCodes: true,
    metadata: {
      user_id: user.id,
      plan_id: PLAN_IDS.SORCERER_ANNUAL,
    },
    subscriptionMetadata: {
      user_id: user.id,
      plan_id: PLAN_IDS.SORCERER_ANNUAL,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}
