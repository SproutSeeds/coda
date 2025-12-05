import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import { progression } from "@/lib/db/schema/monetization";
import { eq } from "drizzle-orm";

// Check if user has visited quest-hub today
export async function GET() {
  const session = await auth();
  const user = session?.user;
  const userId = user && typeof user === "object" ? (user as { id?: string }).id : undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get user's progression record
  const [prog] = await db
    .select({ questHubLastVisit: progression.questHubLastVisit })
    .from(progression)
    .where(eq(progression.userId, userId));

  if (!prog) {
    // No progression record - first visit ever
    return NextResponse.json({ isFirstVisitToday: true });
  }

  const lastVisit = prog.questHubLastVisit;
  if (!lastVisit) {
    // Never visited quest-hub before
    return NextResponse.json({ isFirstVisitToday: true });
  }

  // Check if last visit was today
  const today = new Date().toISOString().split("T")[0];
  const lastVisitDate = lastVisit.toISOString().split("T")[0];

  return NextResponse.json({ isFirstVisitToday: lastVisitDate !== today });
}

// Mark today as visited
export async function POST() {
  const session = await auth();
  const user = session?.user;
  const userId = user && typeof user === "object" ? (user as { id?: string }).id : undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Update or insert progression record with today's visit
  await db
    .insert(progression)
    .values({
      userId,
      questHubLastVisit: new Date(),
    })
    .onConflictDoUpdate({
      target: progression.userId,
      set: {
        questHubLastVisit: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}
