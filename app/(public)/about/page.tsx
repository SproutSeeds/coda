import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "About",
  description: "Why Coda exists, how we build, and what we are empowering product teams to do.",
};

const pillars = [
  {
    title: "Ideas stay in motion",
    body: "From the first spark to a production-ready spec, Coda keeps every idea searchable, undoable, and reorderable. Real-time drag-and-drop, keyboard accessible flows, and frictionless search mean momentum never stalls.",
  },
  {
    title: "Teams ship with confidence",
    body: "Auth.js powered sign-in, rate-limited server actions, and analytics hooks keep the workspace secure and observable so teams can focus on the work—not the scaffolding.",
  },
  {
    title: "Quality is the default",
    body: "Our stack—Next.js App Router, TypeScript, Tailwind, shadcn/ui, Drizzle ORM, and Framer Motion—lets us deliver polished micro-interactions, robust validation, and a11y-friendly experiences by design.",
  },
];

const practices = [
  {
    name: "Intentional planning",
    detail: "Every initiative begins in Specify-backed plans and task lists. The Specs folder is the shared source of truth for goals, risks, and iteration notes.",
  },
  {
    name: "Evidence-first shipping",
    detail: "We codify flows with Vitest, Playwright, and Lighthouse before declaring work complete. Undo windows, search precision, and analytics events are all validated in CI.",
  },
  {
    name: "Operational empathy",
    detail: "We document environment setup—from Docker Postgres to Upstash and Vercel—so anyone can clone, run, and deploy with confidence in minutes.",
  },
];

const stackHighlights = [
  { label: "App layer", value: "Next.js 14 App Router + Server Actions" },
  { label: "Data", value: "PostgreSQL via Drizzle ORM & drizzle-zod" },
  { label: "Auth", value: "Auth.js with GitHub & email magic links" },
  { label: "Realtime polish", value: "Framer Motion micro-interactions" },
  { label: "Infrastructure", value: "Vercel + Upstash Redis rate limiting" },
];

export default function AboutPage() {
  return (
    <div className="flex w-full flex-col gap-16">
      <header className="space-y-6 text-balance">
        <span className="inline-flex items-center rounded-full border border-border/80 bg-card px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          About Coda
        </span>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">We build the calm workspace where ideas go live.</h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            Coda is a product development hub crafted for builders who value clarity, speed, and craftsmanship. Every screen in the app exists to help teams capture ideas, prioritise roadmaps, and ship with certainty.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 font-medium">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            Built with Next.js, TypeScript, and Specify-driven specs
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 font-medium">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            WCAG AA, performant, and production-ready
          </span>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {pillars.map((pillar) => (
          <Card key={pillar.title} className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{pillar.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[2fr_3fr]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl font-semibold">How we work</CardTitle>
            <p className="text-sm text-muted-foreground">
              A lightweight process that keeps us shipping quickly without sacrificing depth or quality.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {practices.map((practice) => (
              <div key={practice.name} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">{practice.name}</h3>
                <p className="text-sm text-muted-foreground">{practice.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl font-semibold">The stack behind the calm</CardTitle>
            <p className="text-sm text-muted-foreground">Opinionated choices keep the experience consistent, secure, and fast.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {stackHighlights.map((highlight, index) => (
              <div key={highlight.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium text-foreground">
                  <span>{highlight.label}</span>
                  <span className="text-muted-foreground">{highlight.value}</span>
                </div>
                {index < stackHighlights.length - 1 ? <Separator className="bg-border/60" /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl font-semibold">Why it matters</CardTitle>
            <p className="text-sm text-muted-foreground">
              Modern product work is async, distributed, and noisy. Coda distils the workflow into a place where focus and accountability win.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>• Ideas become structured specs instantly with drag-and-drop prioritisation and undo safeties.</p>
            <p>• Product, design, and engineering see the same truth—validated through contract tests, rate limits, and analytics.</p>
            <p>• Setup takes minutes: clone, run the Docker Postgres container, configure Upstash and Vercel, and start shipping.</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl font-semibold">What’s next</CardTitle>
            <p className="text-sm text-muted-foreground">
              We are expanding auth pathways, refining undo history, and layering in collaborative insights so more teams can trust Coda with their product backlog.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Upcoming focus areas include full GitHub and passwordless email authentication, richer analytics, and streamlined deployment tooling.</p>
            <p>If you are iterating on product ideas every day, we want Coda to feel like the teammate who keeps rhythm.</p>
          </CardContent>
        </Card>
      </section>

      <footer className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/60 bg-card/90 px-6 py-8 sm:flex-row sm:items-center">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="text-base font-semibold text-foreground">Ready to see your ideas go live?</p>
          <p>Spin up your workspace, sign in securely, and start shaping features with confidence.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="interactive-btn">
            <Link href="/dashboard/ideas">Open Coda</Link>
          </Button>
          <Button asChild variant="outline" className="interactive-btn">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
