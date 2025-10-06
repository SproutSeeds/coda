import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { logoutAction } from "../(public)/login/actions";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">Coda</h1>
            <p className="text-sm text-muted-foreground">Capture, search, and prune your personal idea backlog with Coda.</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">{children}</main>
    </div>
  );
}
