import "server-only";

// Removed unused import

const DEFAULT_APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

type EnvOptions = {
  optional?: boolean;
};

function readEnv(name: string, options: EnvOptions = {}) {
  const value = process.env[name];
  if (!value && !options.optional) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? null;
}

export const stripeEnv = {
  get secretKey() {
    return readEnv("STRIPE_SECRET_KEY")!;
  },
  get publishableKey() {
    return readEnv("STRIPE_PUBLISHABLE_KEY", { optional: true });
  },
  get webhookSecret() {
    return readEnv("STRIPE_WEBHOOK_SECRET", { optional: true });
  },
  prices: {
    get sorcererMonthly() {
      return readEnv("STRIPE_PRICE_SORCERER_MONTHLY")!;
    },
    get sorcererAnnual() {
      return readEnv("STRIPE_PRICE_SORCERER_ANNUAL")!;
    },
    get boosterMana() {
      return readEnv("STRIPE_PRICE_BOOSTER_MANA")!;
    },
  },
  get appBaseUrl() {
    return DEFAULT_APP_URL;
  },
};

export function getPlanPriceId(planId: "monthly" | "annual") {
  if (planId === "monthly") {
    return stripeEnv.prices.sorcererMonthly;
  }
  if (planId === "annual") {
    return stripeEnv.prices.sorcererAnnual;
  }
  throw new Error(`Unsupported plan for Stripe checkout: ${planId}`);
}

export function getBoosterPriceId() {
  return stripeEnv.prices.boosterMana;
}

/**
 * Determine plan variant from a Stripe price ID
 */
export function getPlanVariantFromPriceId(priceId: string | null | undefined): "sorcerer_monthly" | "sorcerer_annual" | null {
  if (!priceId) return null;
  if (priceId === stripeEnv.prices.sorcererAnnual) return "sorcerer_annual";
  if (priceId === stripeEnv.prices.sorcererMonthly) return "sorcerer_monthly";
  return null;
}
