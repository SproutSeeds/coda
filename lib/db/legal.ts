import { and, eq } from "drizzle-orm";

import { getDb } from "./index";
import { documentAcceptances } from "./schema";

type DocumentAcceptanceRecord = {
  documentSlug: string;
  version: string;
};

export async function getDocumentAcceptancesForUser(userId: string): Promise<DocumentAcceptanceRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      documentSlug: documentAcceptances.documentSlug,
      version: documentAcceptances.version,
    })
    .from(documentAcceptances)
    .where(eq(documentAcceptances.userId, userId));

  return rows;
}

export async function recordDocumentAcceptance({
  userId,
  documentSlug,
  version,
  ipAddress,
  userAgent,
}: {
  userId: string;
  documentSlug: string;
  version: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const db = getDb();

  await db
    .insert(documentAcceptances)
    .values({
      userId,
      documentSlug,
      version,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    })
    .onConflictDoNothing({
      target: [documentAcceptances.userId, documentAcceptances.documentSlug, documentAcceptances.version],
      where: and(
        eq(documentAcceptances.userId, userId),
        eq(documentAcceptances.documentSlug, documentSlug),
        eq(documentAcceptances.version, version),
      ),
    });
}
