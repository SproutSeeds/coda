import Link from "next/link";

import { getLegalDocumentSummaries } from "@/lib/legal/documents";

export const metadata = {
  title: "Legal",
  description: "Terms, policies, and agreements that govern Coda CLI.",
};

export default async function LegalIndexPage() {
  const documents = await getLegalDocumentSummaries();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16 sm:py-24">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Legal center</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          These policies apply to the Coda CLI dashboard, API, and tooling. Each document lists its current version so you can track updates over time.
        </p>
      </header>
      <div className="space-y-6">
        {documents.map((doc) => (
          <article key={doc.slug} className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm transition hover:border-border">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold text-foreground">
                <Link href={`/legal/${doc.slug}`} className="hover:underline">
                  {doc.title}
                </Link>
              </h2>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                v{doc.version}
              </span>
            </div>
            {doc.effectiveDate ? (
              <p className="mt-1 text-xs text-muted-foreground">Effective {formatDate(doc.effectiveDate)}</p>
            ) : null}
            <p className="mt-4 text-sm text-muted-foreground">
              <Link href={`/legal/${doc.slug}`} className="inline-flex items-center gap-1 font-medium text-primary">
                Read document ↗
              </Link>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatDate(isoLike: string): string {
  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) {
    return isoLike;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(parsed);
}
