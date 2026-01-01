"use server";

type MutationBudgetOptions = {
  userId: string;
  weight?: number;
  message?: string;
};

/**
 * Wrapper for mutations that may have usage limits.
 * Currently disabled - all mutations are allowed without credit checks.
 * To re-enable credit system, restore enforceLimit call with actorPays.
 */
export async function withMutationBudget<T>(_options: MutationBudgetOptions, work: () => Promise<T>) {
  // Credit system disabled - execute work directly
  return work();
}
