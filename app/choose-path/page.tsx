import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PLAN_IDS, PLAN_LIMITS, PRICING } from "@/lib/plans/constants";
import { ChoosePathClient } from "./choose-path-client";

export default async function ChoosePathPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const db = getDb();
  const [record] = await db
    .select({ planId: users.planId, chosenPath: users.chosenPath })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Only redirect when a plan exists to avoid loops for users with chosenPath but no plan
  if (record?.planId) {
    if (record.chosenPath) {
      redirect("/dashboard/quest-hub");
    }
    redirect("/dashboard");
  }

  // Prepare data for client
  // We use Monthly limits as the reference for "Sorcerer" features
  const sorcererLimits = PLAN_LIMITS[PLAN_IDS.SORCERER_MONTHLY]; 

  return (
    <ChoosePathClient 
      sorcererLimits={sorcererLimits}
      pricing={PRICING}
    />
  );
}
