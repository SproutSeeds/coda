import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

import type { StripeCustomer } from "./http";
import { stripePost } from "./http";

type DbClient = ReturnType<typeof getDb>;
type TransactionCallback = Parameters<DbClient["transaction"]>[0];
type TransactionClient = TransactionCallback extends (tx: infer Tx, ...args: unknown[]) => unknown ? Tx : never;
type DbOrTx = DbClient | TransactionClient;

export async function ensureStripeCustomer(userId: string, options: { db?: DbOrTx } = {}) {
  const db = options.db ?? getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error(`User ${userId} not found while ensuring Stripe customer.`);
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const body = new URLSearchParams();
  if (user.email) {
    body.set("email", user.email);
  }
  if (user.name) {
    body.set("name", user.name);
  }
  body.set("metadata[user_id]", user.id);

  const customer = await stripePost<StripeCustomer>("/customers", body);

  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, user.id));

  return customer.id;
}
