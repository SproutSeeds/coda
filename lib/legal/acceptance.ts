import { getDocumentAcceptancesForUser, recordDocumentAcceptance } from "@/lib/db/legal";

import { getRequiredAcceptanceDocuments } from "./documents";

export async function ensureRequiredDocumentAcceptances(userId: string): Promise<void> {
  const requiredDocuments = await getRequiredAcceptanceDocuments();
  if (!requiredDocuments.length) {
    return;
  }

  const existing = await getDocumentAcceptancesForUser(userId);
  const acceptedMap = new Map(existing.map((entry) => [`${entry.documentSlug}:${entry.version}`, true]));

  await Promise.all(
    requiredDocuments.map(async (doc) => {
      const key = `${doc.slug}:${doc.version}`;
      if (acceptedMap.has(key)) {
        return;
      }

      await recordDocumentAcceptance({
        userId,
        documentSlug: doc.slug,
        version: doc.version,
      });
    }),
  );
}
