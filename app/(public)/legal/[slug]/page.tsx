import { notFound } from "next/navigation";

import { MarkdownRenderer } from "@/components/legal/MarkdownRenderer";
import { getLegalDocument, getLegalDocumentSummaries } from "@/lib/legal/documents";

type LegalDocumentPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const docs = await getLegalDocumentSummaries();
  return docs.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: LegalDocumentPageProps) {
  const { slug } = await params;
  const doc = await getLegalDocument(slug);
  if (!doc) {
    return {};
  }

  return {
    title: `${doc.title} – Coda Legal`,
    description: `${doc.title} (version ${doc.version}) for the Coda CLI platform.`,
  };
}

export default async function LegalDocumentPage({ params }: LegalDocumentPageProps) {
  const { slug } = await params;
  const document = await getLegalDocument(slug);
  if (!document) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16 sm:py-24">
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Coda Legal</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{document.title}</h1>
          </div>
          <div className="text-xs text-muted-foreground">
            <div>Version {document.version}</div>
            {document.effectiveDate ? <div>Effective {formatDate(document.effectiveDate)}</div> : null}
          </div>
        </div>
      </header>
      <MarkdownRenderer content={document.content} />
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
