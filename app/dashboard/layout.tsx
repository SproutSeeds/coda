import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";

import { hasPassword } from "./account/actions";
import { PasswordReminder } from "./components/PasswordReminder";
import { UserMenu } from "./components/UserMenu";
import { AppInstallReminder } from "./components/AppInstallReminder";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const needsPassword = user ? !(await hasPassword(user.id)) : false;
  const discoverText = "Discover Public Ideas";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-transparent">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-4 sm:px-6">
          <div className="flex flex-1 justify-start">
            <Link
              href="/dashboard/ideas"
              className="relative inline-flex cursor-pointer items-center text-left"
              aria-label="Coda dashboard"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-2 h-6 rounded-full bg-gradient-to-r from-primary/40 via-accent/55 to-primary/40 blur-xl opacity-70"
              />
              <span className="relative text-sm font-semibold tracking-wide text-foreground transition-colors hover:text-primary">
                Coda CLI
              </span>
            </Link>
          </div>
          <div className="flex flex-1 justify-center">
            <Link
              href="/dashboard/ideas/discover"
              className="discover-link-anchor group relative inline-flex cursor-pointer items-center text-sm font-semibold tracking-[0.38em] text-foreground transition-colors hover:text-primary"
              aria-label="Discover public ideas"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-2 h-6 rounded-full bg-gradient-to-r from-primary/40 via-accent/55 to-primary/40 blur-xl opacity-70 transition-opacity duration-200 group-hover:opacity-80"
              />
              <span className="discover-wave relative">
                {discoverText.split("").map((char, index) => (
                  <span
                    key={`${char}-${index}`}
                    className="discover-wave-letter"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                ))}
              </span>
            </Link>
          </div>
          <div className="flex flex-1 justify-end">
            <UserMenu className="shrink-0" />
          </div>
        </div>
        <PasswordReminder needsPassword={needsPassword} />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">{children}</main>
      <AppInstallReminder />
    </div>
  );
}
