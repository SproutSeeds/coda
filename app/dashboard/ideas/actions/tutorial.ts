"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { journeyProgress } from "@/lib/db/schema/journey";

export async function updateTutorialStepAction(step: number) {
  const user = await requireUser();
  const db = getDb();

  await db.update(journeyProgress)
    .set({ tutorialStep: step })
    .where(eq(journeyProgress.userId, user.id));

  revalidatePath("/dashboard");
}

export async function skipTutorialAction() {
  const user = await requireUser();
  const db = getDb();

  await db.update(journeyProgress)
    .set({ tutorialSkipped: true })
    .where(eq(journeyProgress.userId, user.id));

  revalidatePath("/dashboard");
}

export async function completeTutorialAction() {
  const user = await requireUser();
  const db = getDb();

  // Set a high number to indicate completion, or logic to say it's done
  // For now, skipping acts as completion of the tutorial flow UI
  await db.update(journeyProgress)
    .set({ tutorialSkipped: true, tutorialStep: 999 }) 
    .where(eq(journeyProgress.userId, user.id));

  revalidatePath("/dashboard");
}
