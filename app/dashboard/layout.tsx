import type { CSSProperties } from "react";

import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";

import { hasPassword } from "./account/actions";
import { PasswordReminder } from "./components/PasswordReminder";
import { UserMenu } from "./components/UserMenu";
import { AppInstallReminder } from "./components/AppInstallReminder";

const discoverColors: CSSProperties = {
  "--discover": "#f9a8d4",
  "--discover-hover": "#f472b6",
} as CSSProperties;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const needsPassword = user ? !(await hasPassword(user.id)) : false;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-transparent">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
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
              <span className="relative whitespace-nowrap text-sm font-semibold tracking-wide text-foreground transition-colors hover:text-primary">
                Coda CLI
              </span>
            </Link>
          </div>
          <div className="flex flex-1 justify-center">
            <Link
              href="/dashboard/ideas/discover"
              className="discover-link-anchor group relative inline-flex cursor-pointer items-center"
              aria-label="Discover public ideas"
              style={discoverColors}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-2 h-6 rounded-full bg-gradient-to-r from-primary/40 via-accent/55 to-primary/40 blur-xl opacity-70 transition-opacity duration-200 group-hover:opacity-80"
              />
              <span className="discover-wave relative inline-flex flex-col items-center gap-1 text-center text-sm font-semibold tracking-[0.38em] leading-tight md:flex-row md:items-center md:gap-4 md:text-left md:tracking-[0.32em]">
                {["Discover", "Public", "Ideas"].map((word, wordIndex) => (
                  <span key={word} className="inline-flex">
                    {word.split("").map((char, charIndex) => (
                      <span
                        key={`${char}-${wordIndex}-${charIndex}`}
                        className="discover-wave-letter"
                        style={{ animationDelay: `${(wordIndex * word.length + charIndex) * 50}ms` }}
                      >
                        {char}
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            </Link>
          </div>
          <div className="flex flex-1 justify-end">
            <UserMenu className="ml-auto" />
          </div>
        </div>
        <PasswordReminder needsPassword={needsPassword} />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">{children}</main>
      <AppInstallReminder />
    </div>
  );
}
