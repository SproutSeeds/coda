import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";

import { hasPassword } from "./account/actions";
import { PasswordReminder } from "./components/PasswordReminder";
import { SignOutButton } from "./components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const needsPassword = user ? !(await hasPassword(user.id)) : false;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <Link
              href="/dashboard/ideas"
              className="cursor-pointer text-lg font-semibold text-foreground hover:text-primary"
            >
              Coda
            </Link>
            <p className="text-sm text-muted-foreground">Ideas go live.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/account" className="text-sm font-medium text-foreground hover:text-primary transition">
              Account
            </Link>
            <SignOutButton />
          </div>
        </div>
        <PasswordReminder needsPassword={needsPassword} />
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">{children}</main>
    </div>
  );
}
