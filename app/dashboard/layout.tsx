import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";

import { hasPassword } from "./account/actions";
import { PasswordReminder } from "./components/PasswordReminder";
import { UserMenu } from "./components/UserMenu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const needsPassword = user ? !(await hasPassword(user.id)) : false;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:gap-6 sm:px-6">
          <div className="space-y-1">
            <Link
              href="/dashboard/ideas"
              className="inline-flex cursor-pointer items-center text-lg font-semibold text-foreground transition hover:text-primary"
            >
              Coda
            </Link>
            <p className="text-sm text-muted-foreground">Ideas go live.</p>
          </div>
          <UserMenu className="ml-auto" />
        </div>
        <PasswordReminder needsPassword={needsPassword} />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
