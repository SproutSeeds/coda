import type { Metadata } from "next";

import { CheckInForm } from "./components/CheckInForm";

export const metadata: Metadata = {
  title: "Meetup Check-in",
  description: "Reserve your seat at the next Coda meetup and get the latest build notes straight to your inbox.",
};

export default function CheckInPage() {
  return (
    <div className="space-y-12">
      <header className="space-y-4 text-balance">
        <h1 className="text-3xl font-semibold sm:text-4xl">Join the next Coda community meetup</h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Tap your email between 11am – 1pm CST on Saturdays to claim meetup rewards, receive the magic login link, and keep your attendance streak alive.
        </p>
      </header>
      <CheckInForm />
      <section className="grid gap-4 rounded-2xl border border-border/50 bg-card/80 px-6 py-6 sm:grid-cols-3 sm:gap-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Next meetup</h2>
          <p className="text-sm text-muted-foreground">Monthly on the second Thursday · Hybrid (NYC + livestream)</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Focus</h2>
          <p className="text-sm text-muted-foreground">Undo history, analytics instrumentation, and shipping server actions safely.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Bring</h2>
          <p className="text-sm text-muted-foreground">Laptop, questions, and an idea worth sharing—hands-on demos encouraged.</p>
        </div>
      </section>
    </div>
  );
}
