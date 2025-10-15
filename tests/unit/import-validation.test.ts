import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MAX_IMPORT_SIZE_BYTES,
  coerceImportPayload,
  normalizeIdeaTitle,
  parseImportEnvelope,
  partitionFeatureMergeCandidates,
} from "@/lib/validations/import";

const FIXTURE_PATH = join(__dirname, "..", "fixtures", "import", "export-sample.json");
const SINGLE_IDEA_PATH = join(__dirname, "..", "fixtures", "import", "single-idea.json");

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
}

describe("import validation helpers", () => {
  it("defaults schemaVersion to 1 when omitted", () => {
    const payload = loadFixture();
    delete payload.schemaVersion;

    const envelope = parseImportEnvelope({ payload, sizeInBytes: 1_024 });

    expect(envelope.schemaVersion).toBe(1);
  });

  it("rejects payloads larger than the configured size limit", () => {
    const payload = loadFixture();

    expect(() =>
      parseImportEnvelope({
        payload,
        sizeInBytes: MAX_IMPORT_SIZE_BYTES + 1,
      }),
    ).toThrow(/5\s?MB|5\s?MiB/i);
  });

  it("normalizes idea titles so comparisons are case and whitespace insensitive", () => {
    expect(normalizeIdeaTitle("  Keep Shipping  ")).toBe("keep shipping");
    expect(normalizeIdeaTitle("KEEP SHIPPING")).toBe("keep shipping");
  });

  it("classifies features into update vs insert buckets for merge planning", () => {
    const envelope = parseImportEnvelope({ payload: loadFixture(), sizeInBytes: 2_048 });

    const existingBundle = envelope.ideas[0];
    const newBundle = envelope.ideas[1];

    const existingFeatureBuckets = partitionFeatureMergeCandidates(existingBundle.features);
    expect(existingFeatureBuckets.updates.map((feature) => feature.id)).toEqual(["existing-feature-0001"]);
    expect(existingFeatureBuckets.inserts).toHaveLength(0);

    const newFeatureBuckets = partitionFeatureMergeCandidates(newBundle.features);
    expect(newFeatureBuckets.updates).toHaveLength(0);
    expect(newFeatureBuckets.inserts).toHaveLength(2);
  });

  it("wraps single-idea export payloads into an envelope", () => {
    const single = JSON.parse(readFileSync(SINGLE_IDEA_PATH, "utf-8"));
    const coerced = coerceImportPayload(single);
    const envelope = parseImportEnvelope({ payload: coerced, sizeInBytes: 1_024 });

    expect(envelope.ideaCount).toBe(1);
    expect(envelope.featureCount).toBe(3);
    expect(envelope.ideas[0]?.idea.title).toBe("Meetup talking points");
  });
});
