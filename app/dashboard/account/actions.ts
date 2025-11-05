"use server";

import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getDb } from "@/lib/db";
import {
  calculateUsdAmountForCredits,
  completeCreditPurchase,
  createCreditPurchase,
  getCreditBalance,
  updateAutoTopUpSettings,
} from "@/lib/db/credits";
import { themePreferences, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { trackEvent } from "@/lib/utils/analytics";
import { updatePasswordSchema } from "@/lib/validations/auth";
import {
  autoTopUpSettingsSchema,
  creditTopUpFinalizeSchema,
  creditTopUpRequestSchema,
  type AutoTopUpSettingsInput,
  type CreditTopUpFinalizeInput,
  type CreditTopUpRequestInput,
} from "@/lib/validations/credits";
import { themePreferenceInputSchema } from "@/lib/validations/theme-preference";

export type UpdatePasswordState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function updatePasswordAction(prevState: UpdatePasswordState, formData: FormData): Promise<UpdatePasswordState> {
  const user = await requireUser();
  const db = getDb();

  const input = updatePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword")?.toString() ?? undefined,
    newPassword: formData.get("newPassword")?.toString() ?? "",
  });

  if (!input.success) {
    const message = input.error.issues[0]?.message ?? "Invalid password format.";
    return { status: "error", message };
  }

  const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!record) {
    return { status: "error", message: "User not found." };
  }

  if (record.passwordHash) {
    if (!input.data.currentPassword) {
      return { status: "error", message: "Enter your current password to update it." };
    }
    const matches = await compare(input.data.currentPassword, record.passwordHash);
    if (!matches) {
      return { status: "error", message: "Current password is incorrect." };
    }
  }

  const nextHash = await hash(input.data.newPassword, 12);
  await db.update(users).set({ passwordHash: nextHash }).where(eq(users.id, user.id));

  await trackEvent({ name: "auth_password_updated", properties: { userId: user.id } });
  revalidatePath("/dashboard/account");
  return { status: "success" };
}

export async function hasPassword(userId: string) {
  const db = getDb();
  const [record] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return Boolean(record?.passwordHash);
}

type UpdateThemePreferenceInput = {
  theme: "light" | "dark";
  source?: "explicit" | "system-default" | "restored";
  promptDismissed?: boolean;
};

export type UpdateThemePreferenceResult = {
  success: true;
  theme: "light" | "dark";
  effectiveSource: "explicit" | "system-default" | "restored";
};

export async function updateThemePreferenceAction(input: UpdateThemePreferenceInput): Promise<UpdateThemePreferenceResult> {
  const user = await requireUser();
  const parsed = themePreferenceInputSchema.parse({ theme: input.theme, source: input.source });
  const db = getDb();
  const now = new Date();

  const promptDismissedAt = input.promptDismissed || parsed.source === "explicit" ? now : undefined;

  await db
    .insert(themePreferences)
    .values({
      userId: user.id,
      theme: parsed.theme,
      source: parsed.source,
      updatedAt: now,
      ...(promptDismissedAt ? { promptDismissedAt } : {}),
    })
    .onConflictDoUpdate({
      target: themePreferences.userId,
      set: {
        theme: parsed.theme,
        source: parsed.source,
        updatedAt: now,
        ...(promptDismissedAt ? { promptDismissedAt } : {}),
      },
    });

  await trackEvent({
    name: "theme_preference.updated",
    properties: {
      userId: user.id,
      theme: parsed.theme,
      source: parsed.source,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("coda-theme", parsed.theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard/account");

  return { success: true, theme: parsed.theme, effectiveSource: parsed.source };
}

export async function loadCreditSummaryAction() {
  const user = await requireUser();
  const balance = await getCreditBalance({ type: "user", id: user.id });
  return balance;
}

export async function initiateCreditTopUpAction(input: CreditTopUpRequestInput) {
  const user = await requireUser();
  const parsed = creditTopUpRequestSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Unable to start credit purchase.";
    throw new Error(message);
  }

  const payload = parsed.data;
  const credits = Number(payload.credits);
  const amountUsd = payload.amountUsd ?? calculateUsdAmountForCredits(credits);

  const purchase = await createCreditPurchase({
    payer: { type: "user", id: user.id },
    credits,
    amountUsd,
    provider: payload.provider,
    initiatedBy: user.id,
    metadata: {
      ...(payload.metadata ?? {}),
      trigger: "manual_top_up",
    },
  });

  await trackEvent({
    name: "credits_purchase.initiated",
    properties: {
      userId: user.id,
      credits,
      amountUsd,
      provider: payload.provider,
      purchaseId: purchase.id,
    },
  });

  return {
    id: purchase.id,
    status: purchase.status,
    credits: Number(purchase.credits),
    amountUsd: Number(purchase.amountUsd),
    provider: purchase.provider,
  };
}

export async function finalizeCreditTopUpAction(input: CreditTopUpFinalizeInput) {
  const user = await requireUser();
  const parsed = creditTopUpFinalizeSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Unable to finalize credit purchase.";
    throw new Error(message);
  }

  const payload = parsed.data;
  const result = await completeCreditPurchase({
    purchaseId: payload.purchaseId,
    providerReference: payload.providerReference ?? null,
    referenceCredits: payload.referenceCredits,
    metadata: payload.metadata ?? {},
    triggeredBy: user.id,
    expectedPayer: { type: "user", id: user.id },
  });

  if (!result) {
    throw new Error("Credit purchase not found.");
  }

  await trackEvent({
    name: "credits_purchase.completed",
    properties: {
      userId: user.id,
      purchaseId: result.purchase.id,
      credits: Number(result.purchase.credits),
      amountUsd: Number(result.purchase.amountUsd),
      provider: result.purchase.provider,
    },
  });

  revalidatePath("/dashboard/account");

  return {
    purchase: result.purchase,
    balance: result.balance,
  };
}

export async function updateAutoTopUpSettingsAction(input: AutoTopUpSettingsInput) {
  const user = await requireUser();
  const parsed = autoTopUpSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid auto top-up settings.";
    throw new Error(message);
  }

  const next = await updateAutoTopUpSettings({
    payer: { type: "user", id: user.id },
    enabled: parsed.data.enabled,
    credits: parsed.data.credits,
    threshold: parsed.data.threshold,
    paymentMethodId: parsed.data.paymentMethodId ?? null,
  });

  await trackEvent({
    name: "credits_autotopup.updated",
    properties: {
      userId: user.id,
      enabled: next.autoTopUpEnabled,
      credits: next.autoTopUpCredits,
      threshold: next.autoTopUpThreshold,
      paymentMethodId: next.autoTopUpPaymentMethodId,
    },
  });

  revalidatePath("/dashboard/account");
  return next;
}
