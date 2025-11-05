"use server";

import { enforceLimit } from "@/lib/limits/guard";
import { actorPays } from "@/lib/limits/payer";

type MutationBudgetOptions = {
  userId: string;
  weight?: number;
  message?: string;
};

export async function withMutationBudget<T>(options: MutationBudgetOptions, work: () => Promise<T>) {
  const { userId, weight = 1, message = "You’ve reached your daily mutation budget. Try again soon or upgrade your plan." } = options;
  await enforceLimit({
    scope: { type: "user", id: userId },
    metric: "mutations.per_user.daily",
    userId,
    increment: weight,
    payer: actorPays(userId),
    message,
  });
  return work();
}
