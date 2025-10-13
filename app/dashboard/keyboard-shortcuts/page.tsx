import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Keyboard shortcuts",
  description: "Quick reference for the shortcuts Coda supports across the workspace.",
};

const shortcuts: Array<{ combo: string; description: string }> = [
  {
    combo: "ESC",
    description:
      "Dismiss drawers, close composers, exit edit mode, cancel deletes, and skip the intro animation without touching the mouse.",
  },
  {
    combo: "ENTER",
    description:
      "Submit whatever is focused – login forms, idea and feature editors, suggestion threads, and quick actions all respond instantly.",
  },
  {
    combo: "SHIFT + ENTER",
    description: "Insert a newline inside multiline inputs (idea notes, suggestion updates, feature details) without submitting.",
  },
];

export default async function KeyboardShortcutsPage() {
  await requireUser();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Keyboard shortcuts</h1>
        <p className="text-sm text-muted-foreground">
          Keep your flow tight with the shortcuts Coda supports everywhere. Each key combo is listed once – no matter
          where you are in the workspace, it behaves the same.
        </p>
      </div>

      <article className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm">
        <ul className="space-y-3">
          {shortcuts.map((item) => (
            <li key={item.combo} className="flex flex-wrap items-start gap-3 text-sm text-muted-foreground">
              <span className="inline-flex min-w-[120px] items-center gap-1 rounded-full border border-border bg-muted/30 px-3 py-1 font-semibold uppercase tracking-wide text-xs text-foreground">
                {item.combo}
              </span>
              <span className="flex-1 leading-relaxed text-foreground/90">{item.description}</span>
            </li>
          ))}
        </ul>
      </article>

      <section className="rounded-2xl border border-primary/40 bg-primary/5 p-6 text-sm text-primary">
        <p className="font-medium">Pro tip</p>
        <p className="mt-2 text-primary/80">
          We update this list as new flows roll out. If you spot a shortcut that feels missing, drop a note in the Suggestion box from the workspace menu.
        </p>
      </section>
    </section>
  );
}
