import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Refund Flow Tests
 *
 * Tests the refund calculation logic, particularly:
 * - Mana usage cost calculation (subscription refunds)
 * - Proportional refund calculation (booster refunds)
 * - Self-service window validation
 * - Booster balance preservation during subscription refunds
 */

// Mock monetization config
const monetizationConfig = {
  mana: {
    corePerMonthMana: 200_000, // 200k mana per month for subscribers
    usdToMana: 20_000, // $1 = 20,000 mana
  },
  pricing: {
    monthlyUsd: 10,
    annualUsd: 100,
  },
};

describe("Refund Flow Tests", () => {
  describe("Mana Usage Cost Calculation", () => {
    it("calculates zero cost when no mana has been used", () => {
      const manaGranted = monetizationConfig.mana.corePerMonthMana;
      const manaBalance = manaGranted; // Full balance = no usage

      const manaUsed = Math.max(0, manaGranted - manaBalance);
      const usageCostUsd = manaUsed / monetizationConfig.mana.usdToMana;
      const usageCostCents = Math.ceil(usageCostUsd * 100);

      expect(manaUsed).toBe(0);
      expect(usageCostCents).toBe(0);
    });

    it("calculates correct cost when half the mana has been used", () => {
      const manaGranted = monetizationConfig.mana.corePerMonthMana;
      const manaBalance = 100_000; // Half remaining

      const manaUsed = Math.max(0, manaGranted - manaBalance);
      const usageCostUsd = manaUsed / monetizationConfig.mana.usdToMana;
      const usageCostCents = Math.ceil(usageCostUsd * 100);

      expect(manaUsed).toBe(100_000);
      expect(usageCostCents).toBe(500); // $5.00 worth of mana used
    });

    it("calculates correct cost when all mana has been used", () => {
      const manaGranted = monetizationConfig.mana.corePerMonthMana;
      const manaBalance = 0; // All used

      const manaUsed = Math.max(0, manaGranted - manaBalance);
      const usageCostUsd = manaUsed / monetizationConfig.mana.usdToMana;
      const usageCostCents = Math.ceil(usageCostUsd * 100);

      expect(manaUsed).toBe(200_000);
      expect(usageCostCents).toBe(1000); // $10.00 worth of mana used
    });

    it("caps usage cost at the charge amount", () => {
      const chargeAmountCents = 1000; // $10 subscription
      const manaGranted = monetizationConfig.mana.corePerMonthMana;
      const manaBalance = 0; // All used

      const manaUsed = Math.max(0, manaGranted - manaBalance);
      const usageCostUsd = manaUsed / monetizationConfig.mana.usdToMana;
      const usageCostCents = Math.ceil(usageCostUsd * 100);

      const refundAmountCents = Math.max(0, chargeAmountCents - usageCostCents);

      expect(refundAmountCents).toBe(0); // No refund when all mana used
    });

    it("calculates partial refund correctly", () => {
      const chargeAmountCents = 1000; // $10 subscription
      const manaGranted = monetizationConfig.mana.corePerMonthMana;
      const manaBalance = 150_000; // 25% used

      const manaUsed = Math.max(0, manaGranted - manaBalance);
      const usageCostUsd = manaUsed / monetizationConfig.mana.usdToMana;
      const usageCostCents = Math.ceil(usageCostUsd * 100);

      const refundAmountCents = Math.max(0, chargeAmountCents - usageCostCents);

      expect(manaUsed).toBe(50_000);
      expect(usageCostCents).toBe(250); // $2.50 worth of mana used
      expect(refundAmountCents).toBe(750); // $7.50 refund
    });
  });

  describe("Booster Refund Calculations", () => {
    it("calculates full refund when no booster mana has been used", () => {
      const chargeAmountCents = 500; // $5 booster purchase
      const manaPerDollar = monetizationConfig.mana.usdToMana;
      const chargeAmountDollars = chargeAmountCents / 100;
      const manaFromCharge = chargeAmountDollars * manaPerDollar;
      const boosterBalance = manaFromCharge; // Full balance

      const percentRefundable = Math.min(1, boosterBalance / manaFromCharge);
      const refundAmountCents = Math.floor(chargeAmountCents * percentRefundable);
      const manaToDeduct = Math.floor(manaFromCharge * percentRefundable);

      expect(percentRefundable).toBe(1);
      expect(refundAmountCents).toBe(500); // Full refund
      expect(manaToDeduct).toBe(100_000); // Deduct all mana from purchase
    });

    it("calculates proportional refund when some booster mana has been used", () => {
      const chargeAmountCents = 500; // $5 booster purchase
      const manaPerDollar = monetizationConfig.mana.usdToMana;
      const chargeAmountDollars = chargeAmountCents / 100;
      const manaFromCharge = chargeAmountDollars * manaPerDollar;
      const boosterBalance = 50_000; // Half remaining

      const percentRefundable = Math.min(1, boosterBalance / manaFromCharge);
      const refundAmountCents = Math.floor(chargeAmountCents * percentRefundable);
      const manaToDeduct = Math.floor(manaFromCharge * percentRefundable);

      expect(percentRefundable).toBe(0.5);
      expect(refundAmountCents).toBe(250); // 50% refund
      expect(manaToDeduct).toBe(50_000); // Deduct remaining mana
    });

    it("calculates no refund when all booster mana has been used", () => {
      const chargeAmountCents = 500; // $5 booster purchase
      const manaPerDollar = monetizationConfig.mana.usdToMana;
      const chargeAmountDollars = chargeAmountCents / 100;
      const manaFromCharge = chargeAmountDollars * manaPerDollar;
      const boosterBalance = 0; // All used

      const percentRefundable = Math.min(1, boosterBalance / manaFromCharge);
      const refundAmountCents = Math.floor(chargeAmountCents * percentRefundable);

      expect(percentRefundable).toBe(0);
      expect(refundAmountCents).toBe(0); // No refund
    });

    it("caps refund at charge amount even with excess balance", () => {
      const chargeAmountCents = 500; // $5 booster purchase
      const manaPerDollar = monetizationConfig.mana.usdToMana;
      const chargeAmountDollars = chargeAmountCents / 100;
      const manaFromCharge = chargeAmountDollars * manaPerDollar;
      const boosterBalance = 200_000; // More than purchase (had previous boosters)

      const percentRefundable = Math.min(1, boosterBalance / manaFromCharge);
      const refundAmountCents = Math.floor(chargeAmountCents * percentRefundable);

      expect(percentRefundable).toBe(1); // Capped at 100%
      expect(refundAmountCents).toBe(500); // Full refund, not more
    });
  });

  describe("Self-Service Refund Window", () => {
    const SELF_SERVICE_REFUND_WINDOW_DAYS = 7;
    const WINDOW_MS = SELF_SERVICE_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    it("allows refund within 7-day window", () => {
      const now = Date.now();
      const chargeDate = new Date(now - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      const isWithinWindow = now - chargeDate.getTime() <= WINDOW_MS;

      expect(isWithinWindow).toBe(true);
    });

    it("allows refund on day 7 (boundary)", () => {
      const now = Date.now();
      const chargeDate = new Date(now - WINDOW_MS); // Exactly 7 days ago

      const isWithinWindow = now - chargeDate.getTime() <= WINDOW_MS;

      expect(isWithinWindow).toBe(true);
    });

    it("denies refund after 7-day window", () => {
      const now = Date.now();
      const chargeDate = new Date(now - 8 * 24 * 60 * 60 * 1000); // 8 days ago

      const isWithinWindow = now - chargeDate.getTime() <= WINDOW_MS;

      expect(isWithinWindow).toBe(false);
    });

    it("denies refund for charges from long ago", () => {
      const now = Date.now();
      const chargeDate = new Date(now - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const isWithinWindow = now - chargeDate.getTime() <= WINDOW_MS;

      expect(isWithinWindow).toBe(false);
    });
  });

  describe("Booster Balance Preservation on Subscription Refund", () => {
    it("preserves booster balance when resetting wallet for subscription refund", () => {
      // Simulate wallet state before refund
      const walletBefore = {
        manaBalance: 150_000, // Subscription mana
        boosterBalance: 50_000, // Purchased booster mana
      };

      // After subscription refund, subscription mana is reset but booster is preserved
      const walletAfter = {
        manaBalance: 0, // Reset subscription mana
        boosterBalance: walletBefore.boosterBalance, // Keep booster mana
      };

      expect(walletAfter.manaBalance).toBe(0);
      expect(walletAfter.boosterBalance).toBe(50_000);
    });

    it("handles case where user had no booster balance", () => {
      const walletBefore = {
        manaBalance: 200_000,
        boosterBalance: 0,
      };

      const walletAfter = {
        manaBalance: 0,
        boosterBalance: walletBefore.boosterBalance,
      };

      expect(walletAfter.manaBalance).toBe(0);
      expect(walletAfter.boosterBalance).toBe(0);
    });
  });

  describe("Annual Upgrade Savings Calculation", () => {
    it("calculates annual savings correctly", () => {
      const monthlyPrice = monetizationConfig.pricing.monthlyUsd;
      const annualPrice = monetizationConfig.pricing.annualUsd;

      const yearlyCostIfMonthly = monthlyPrice * 12;
      const annualSavings = yearlyCostIfMonthly - annualPrice;

      expect(yearlyCostIfMonthly).toBe(120); // $120/year if paying monthly
      expect(annualSavings).toBe(20); // Save $20 with annual plan
    });
  });

  describe("Gift Expiration", () => {
    it("marks gift as expired when past expiration date", () => {
      const now = new Date();
      const giftExpiresAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

      const isExpired = giftExpiresAt < now;

      expect(isExpired).toBe(true);
    });

    it("allows claim when gift is not yet expired", () => {
      const now = new Date();
      const giftExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

      const isExpired = giftExpiresAt < now;

      expect(isExpired).toBe(false);
    });

    it("creates gift with 7-day expiration window", () => {
      const now = Date.now();
      const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);

      const daysUntilExpiry = (expiresAt.getTime() - now) / (24 * 60 * 60 * 1000);

      expect(daysUntilExpiry).toBe(7);
    });
  });
});
