import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "./components/SignOutButton";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/dashboard/ideas" className="text-lg font-semibold text-foreground hover:underline">
              Coda
            </Link>
            <p className="text-sm text-muted-foreground">Capture, search, and prune your personal idea backlog with Coda.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/account" className="text-sm font-medium text-primary hover:underline">
              Account
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">{children}</main>
    </div>
  );
}
