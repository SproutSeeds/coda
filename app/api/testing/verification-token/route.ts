import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { verificationTokens } from "@/lib/db/schema";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const emailParam = url.searchParams.get("email");
  const consume = url.searchParams.get("consume") === "true";
  if (!emailParam) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  const email = emailParam.toLowerCase();

  const db = getDb();
  const [token] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, email))
    .orderBy(desc(verificationTokens.expires))
    .limit(1);

  if (!token) {
    return NextResponse.json({ token: null }, { status: 404 });
  }

  if (consume) {
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, email))
      .execute();
  }

  return NextResponse.json({ token: token.token, expires: token.expires });
}
