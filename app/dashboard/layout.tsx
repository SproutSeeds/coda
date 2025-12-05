import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { journeyProgress } from "@/lib/db/schema/journey";

import { hasPassword } from "./account/actions";
import { PasswordReminder } from "./components/PasswordReminder";
import { UserMenu } from "./components/UserMenu";
import { AppInstallReminder } from "./components/AppInstallReminder";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import { DashboardShell } from "./DashboardShell";
import { DashboardSpaceProvider } from "./DashboardSpaceProvider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // If not logged in, middleware will handle redirect to login
  if (!user) {
    redirect("/login");
  }

  // Check if user has chosen a path or plan
  const db = getDb();
  const [record] = await db
    .select({ planId: users.planId, chosenPath: users.chosenPath })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Redirect to choose-path if no path or plan selected
  // Wanderers have chosenPath but no planId, Sorcerers have both
  if (!record?.planId && !record?.chosenPath) {
    redirect("/choose-path");
  }

  const needsPassword = !(await hasPassword(user.id));

  // Fetch tutorial state
  const journey = await db.query.journeyProgress.findFirst({
    where: eq(journeyProgress.userId, user.id),
    columns: {
      tutorialStep: true,
      tutorialSkipped: true,
    },
  });

  // Header content to pass to DashboardShell
  // Fixed layout: Coda CLI branding (top-left) with original glow, UserMenu (top-right)
  const headerContent = (
    <>
      {/* Coda CLI branding - fixed top left with original gradient glow */}
      <Link
        href="/dashboard/ideas"
        className="fixed top-6 left-6 z-50 inline-flex cursor-pointer items-center"
        aria-label="Coda dashboard"
        data-tutorial="sidebar-ideas-link"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-2 h-6 rounded-full bg-gradient-to-r from-primary/40 via-accent/55 to-primary/40 blur-xl opacity-70"
        />
        <span className="relative whitespace-nowrap text-sm font-semibold tracking-wide text-foreground transition-colors hover:text-primary">
          Coda CLI
        </span>
      </Link>

      {/* User menu - fixed top right */}
      <UserMenu />

      <PasswordReminder needsPassword={needsPassword} />
    </>
  );

  return (
    <TutorialProvider
      initialStep={journey?.tutorialStep ?? 0}
      isSkipped={journey?.tutorialSkipped ?? false}
    >
      <DashboardSpaceProvider
        chosenPath={record?.chosenPath as "wanderer" | "sorcerer" | null}
      >
        <DashboardShell header={headerContent}>
          {children}
          <AppInstallReminder />
        </DashboardShell>
      </DashboardSpaceProvider>
    </TutorialProvider>
  );
}
