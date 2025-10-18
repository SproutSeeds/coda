import { cache } from "react";
import fs from "node:fs/promises";
import path from "node:path";

type PublishedDocumentConfig = {
  slug: string;
  file: string;
  requiresAcceptance?: boolean;
  order: number;
};

const PUBLISHED_DOCUMENTS: PublishedDocumentConfig[] = [
  { slug: "terms-of-service", file: "terms-of-service.md", requiresAcceptance: true, order: 10 },
  { slug: "privacy-policy", file: "privacy-policy.md", requiresAcceptance: true, order: 20 },
  { slug: "cookie-policy", file: "cookie-policy.md", order: 30 },
  { slug: "acceptable-use-policy", file: "acceptable-use-policy.md", order: 40 },
  { slug: "dmca-policy", file: "dmca-policy.md", order: 50 },
  { slug: "data-processing-addendum", file: "data-processing-addendum.md", order: 60 },
];

const LEGAL_DIR = path.join(process.cwd(), "legal");

export type LegalDocument = {
  slug: string;
  title: string;
  version: string;
  effectiveDate?: string;
  content: string;
  requiresAcceptance: boolean;
};

export type LegalDocumentSummary = Omit<LegalDocument, "content">;

const readDocument = cache(async (slug: string): Promise<LegalDocument> => {
  const entry = PUBLISHED_DOCUMENTS.find((doc) => doc.slug === slug);
  if (!entry) {
    throw new Error(`Unknown legal document slug: ${slug}`);
  }

  const filePath = path.join(LEGAL_DIR, entry.file);
  const raw = await fs.readFile(filePath, "utf8");
  const { frontMatter, body } = parseFrontMatter(raw);

  const title = frontMatter.title ?? entry.slug;
  const version = frontMatter.version ?? "0";
  const effectiveDate = frontMatter.effectiveDate;

  return {
    slug: entry.slug,
    title,
    version,
    effectiveDate,
    content: body,
    requiresAcceptance: Boolean(entry.requiresAcceptance),
  };
});

export const getPublishedLegalDocuments = cache(async (): Promise<LegalDocument[]> => {
  const docs = await Promise.all(PUBLISHED_DOCUMENTS.sort((a, b) => a.order - b.order).map((doc) => readDocument(doc.slug)));
  return docs;
});

export const getLegalDocumentSummaries = cache(async (): Promise<LegalDocumentSummary[]> => {
  const docs = await getPublishedLegalDocuments();
  return docs.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    version: doc.version,
    effectiveDate: doc.effectiveDate,
    requiresAcceptance: doc.requiresAcceptance,
  }));
});

export async function getLegalDocument(slug: string): Promise<LegalDocument | null> {
  try {
    return await readDocument(slug);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`legal: failed to load document for slug "${slug}":`, error);
    }
    return null;
  }
}

export const getRequiredAcceptanceDocuments = cache(async (): Promise<LegalDocumentSummary[]> => {
  const summaries = await getLegalDocumentSummaries();
  return summaries.filter((doc) => doc.requiresAcceptance);
});

type FrontMatter = Record<string, string>;

function parseFrontMatter(raw: string): { frontMatter: FrontMatter; body: string } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { frontMatter: {}, body: raw };
  }

  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontMatter: {}, body: raw };
  }

  const frontMatterBlock = trimmed.slice(3, endIndex).trim();
  const rest = trimmed.slice(endIndex + 4);

  const frontMatterLines = frontMatterBlock.split(/\r?\n/);
  const frontMatter: FrontMatter = {};
  for (const line of frontMatterLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const valueRaw = line.slice(separatorIndex + 1).trim();
    frontMatter[key] = stripQuotes(valueRaw);
  }

  return { frontMatter, body: rest.trim() };
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
