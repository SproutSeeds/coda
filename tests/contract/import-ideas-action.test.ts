import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUserMock,
  listIdeasMock,
  listFeaturesMock,
  createIdeaMock,
  updateIdeaMock,
  createFeatureMock,
  updateFeatureMock,
  setFeatureCompletionMock,
  trackEventMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  listIdeasMock: vi.fn(),
  listFeaturesMock: vi.fn(),
  createIdeaMock: vi.fn(),
  updateIdeaMock: vi.fn(),
  createFeatureMock: vi.fn(),
  updateFeatureMock: vi.fn(),
  setFeatureCompletionMock: vi.fn(),
  trackEventMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/db/ideas", () => ({
  listIdeas: listIdeasMock,
  createIdea: createIdeaMock,
  updateIdea: updateIdeaMock,
}));

vi.mock("@/lib/db/features", () => ({
  listFeatures: listFeaturesMock,
  createFeature: createFeatureMock,
  updateFeature: updateFeatureMock,
  setFeatureCompletion: setFeatureCompletionMock,
}));

vi.mock("@/lib/utils/analytics", () => ({
  trackEvent: trackEventMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { importIdeasAction } from "@/app/dashboard/ideas/actions/import";

const FIXTURE_PATH = join(__dirname, "..", "fixtures", "import", "export-sample.json");
const INVALID_PATH = join(__dirname, "..", "fixtures", "import", "invalid.json");

const existingIdea = {
  id: "existing-idea-0001",
  userId: "owner-token",
  title: "Existing Idea",
  notes: "Legacy notes before import",
  position: 1000,
  createdAt: "2025-10-01T15:00:00.000Z",
  updatedAt: "2025-10-05T18:00:00.000Z",
  starred: true,
  githubUrl: "https://github.com/example/existing",
  linkLabel: "GitHub Repository",
  deletedAt: null,
  undoToken: null,
  undoExpiresAt: null,
};

const existingFeature = {
  id: "existing-feature-0001",
  ideaId: existingIdea.id,
  title: "Existing Feature",
  notes: "Legacy feature notes",
  detail: "",
  detailLabel: "Detail",
  position: 1000,
  createdAt: "2025-10-01T15:30:00.000Z",
  updatedAt: "2025-10-05T18:00:00.000Z",
  starred: false,
  completed: false,
  completedAt: null,
  deletedAt: null,
};

function attachFile(formData: FormData, path: string, name: string) {
  const buffer = readFileSync(path);
  const blob = new Blob([buffer], { type: "application/json" });
  formData.set("file", blob, name);
}

beforeEach(() => {
  vi.clearAllMocks();

  requireUserMock.mockResolvedValue({ id: "owner-token" });

  listIdeasMock.mockReset();
  listIdeasMock
    .mockResolvedValueOnce({ items: [existingIdea], nextCursor: null })
    .mockResolvedValue({ items: [], nextCursor: null });

  listFeaturesMock.mockImplementation(async (_userId: string, ideaId: string) => {
    if (ideaId === existingIdea.id) {
      return [existingFeature];
    }
    return [];
  });

  createIdeaMock.mockResolvedValue({
    ...existingIdea,
    id: "new-idea-id",
    title: "New Idea From Import",
    notes: "Brand new idea created by importing JSON.",
    starred: false,
  });

  updateIdeaMock.mockImplementation(async (_userId: string, id: string, payload: Record<string, unknown>) => ({
    ...existingIdea,
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
  }));

  createFeatureMock.mockImplementation(async (_userId: string, input: Record<string, unknown>) => ({
    id: `feature-${Math.random().toString(36).slice(2, 8)}`,
    ideaId: input.ideaId,
    title: input.title,
    notes: input.notes ?? "",
    detail: input.detail ?? "",
    detailLabel: input.detailLabel ?? "Detail",
    position: input.position ?? Date.now(),
    starred: input.starred ?? false,
    completed: input.completed ?? false,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    completedAt: null,
    deletedAt: null,
  }));

  updateFeatureMock.mockImplementation(async (_userId: string, input: Record<string, unknown>) => ({
    ...existingFeature,
    ...input,
    updatedAt: new Date().toISOString(),
  }));
});

describe("importIdeasAction", () => {
  it("returns a preview diff without mutating data", async () => {
    const formData = new FormData();
    formData.set("stage", "preview");
    attachFile(formData, FIXTURE_PATH, "export.json");

    const response = await importIdeasAction(formData);

    expect(response.status).toBe("preview");
    if (response.status !== "preview") {
      throw new Error("Expected preview response");
    }

    expect(response.diff).toMatchObject({
      newIdeas: 1,
      updatedIdeas: 1,
      newFeatures: 2,
      updatedFeatures: 1,
    });
    expect(response.diff.conflicts?.length ?? 0).toBeGreaterThanOrEqual(1);

    expect(createIdeaMock).not.toHaveBeenCalled();
    expect(updateIdeaMock).not.toHaveBeenCalled();
    expect(createFeatureMock).not.toHaveBeenCalled();
    expect(updateFeatureMock).not.toHaveBeenCalled();
  });

  it("applies updates based on conflict decisions and returns a completion summary", async () => {
    const formData = new FormData();
    formData.set("stage", "commit");
    attachFile(formData, FIXTURE_PATH, "export.json");
    formData.set(
      "decisions",
      JSON.stringify([
        { ideaTitle: "Existing Idea", action: "update" },
        { ideaTitle: "New Idea From Import", action: "create-new" },
      ]),
    );

    const response = await importIdeasAction(formData);

    expect(response.status).toBe("complete");
    if (response.status !== "complete") {
      throw new Error("Expected commit response");
    }

    expect(response.summary).toMatchObject({
      createdIdeas: 1,
      updatedIdeas: 1,
      createdFeatures: 2,
      updatedFeatures: 1,
    });

    expect(updateIdeaMock).toHaveBeenCalledTimes(1);
    const updateArgs = updateIdeaMock.mock.calls[0];
    expect(updateArgs[1]).toBe("existing-idea-0001");
    expect(updateArgs[2]).toMatchObject({ notes: expect.stringContaining("Current notes") });
    expect(createIdeaMock).toHaveBeenCalledTimes(1);
    expect(createFeatureMock).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed JSON payloads", async () => {
    const formData = new FormData();
    formData.set("stage", "preview");
    attachFile(formData, INVALID_PATH, "invalid.json");

    await expect(importIdeasAction(formData)).rejects.toThrow(/invalid|malformed/i);
  });
});
