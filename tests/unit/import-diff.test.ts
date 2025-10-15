import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildImportAnalysis } from "@/lib/utils/import-diff";
import { coerceImportPayload, parseImportEnvelope } from "@/lib/validations/import";

const SINGLE_IDEA_PATH = join(__dirname, "..", "fixtures", "import", "single-idea.json");

function loadSingleEnvelope() {
  const raw = JSON.parse(readFileSync(SINGLE_IDEA_PATH, "utf-8"));
  const coerced = coerceImportPayload(raw);
  return parseImportEnvelope({ payload: coerced, sizeInBytes: Buffer.byteLength(JSON.stringify(coerced)) });
}

describe("buildImportAnalysis", () => {
  it("flags duplicate titles even when the payload matches existing data", () => {
    const envelope = loadSingleEnvelope();
    const existingIdea = envelope.ideas[0]?.idea;
    const existingFeatures = envelope.ideas[0]?.features ?? [];
    if (!existingIdea) {
      throw new Error("Fixture missing idea");
    }

    const analysis = buildImportAnalysis({
      envelope,
      existingIdeas: [existingIdea as any],
      existingFeaturesByIdea: new Map([[existingIdea.id!, existingFeatures as any]]),
    });

    expect(analysis.summary.conflicts).toHaveLength(1);
    expect(analysis.summary.unchangedIdeas).toBeGreaterThanOrEqual(1);
    expect(analysis.entries[0]?.hasConflict).toBe(true);
    expect(analysis.entries[0]?.warnings).toEqual([]);
  });
});
