import { notFound } from "next/navigation";

import { loadIdeaWithFeatures } from "../actions";
import { IdeaDetail } from "../components/IdeaDetail";

function isMissingFeatureColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error && typeof (error as { message: unknown }).message === "string"
    ? (error as { message: string }).message
    : "";
  const code =
    "code" in error && typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;

  if (code !== "42703") {
    return false;
  }

  return message.includes("detail_sections") || message.includes("super_starred");
}

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof loadIdeaWithFeatures>> | null = null;
  try {
    data = await loadIdeaWithFeatures(id);
  } catch (error) {
    if (isMissingFeatureColumns(error)) {
      return (
        <section className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-900">
          <header>
            <h1 className="text-base font-semibold text-amber-900">Run the latest database migration</h1>
          </header>
          <p>
            The current database is missing the latest feature metadata columns (such as the
            <code className="rounded bg-amber-900/10 px-1">detail_sections</code> or
            <code className="rounded bg-amber-900/10 px-1">super_starred</code> columns). Apply the newest Drizzle migration and reload this page.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <code className="rounded bg-amber-900/10 px-2 py-1">pnpm db:migrate</code> (or deploy the migration in Neon/Vercel).
            </li>
            <li>Refresh the dashboard once the migration completes.</li>
          </ol>
          <p className="text-xs text-amber-800/90">
            If you&apos;re running locally, ensure Docker/Neon is online before executing the migration command.
          </p>
        </section>
      );
    }

    throw error;
  }

  if (!data) {
    notFound();
  }

  return (
    <section className="space-y-8">
      <IdeaDetail idea={data.idea} features={data.features} deletedFeatures={data.deletedFeatures} />
    </section>
  );
}
