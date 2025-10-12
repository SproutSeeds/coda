import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db/suggestions", () => ({
  resolveDeveloperId: vi.fn(),
  getSuggestion: vi.fn(),
  getSuggestionForSubmitter: vi.fn(),
  listSuggestionUpdates: vi.fn(),
}));

import { loadSuggestionDetailAction } from "@/app/dashboard/suggestions/actions";
import { requireUser } from "@/lib/auth/session";
import {
  resolveDeveloperId,
  getSuggestion,
  getSuggestionForSubmitter,
  listSuggestionUpdates,
} from "@/lib/db/suggestions";

const baseSuggestion = {
  id: "suggestion-1",
  ownerId: "dev-123",
  submittedBy: null,
  submittedEmail: "viewer@example.com",
  title: "Feedback",
  notes: "Make it better",
  position: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  starred: false,
  deletedAt: null,
  undoToken: null,
  undoExpiresAt: null,
  completed: false,
  completedAt: null,
};

const suggestionUpdates = [
  {
    id: "update-1",
    suggestionId: "suggestion-1",
    authorId: "dev-123",
    authorEmail: "codyshanemitchell@gmail.com",
    body: "Acknowledged",
    createdAt: new Date().toISOString(),
  },
];

describe("loadSuggestionDetailAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("grants developer access when the viewer email matches", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "viewer-1",
      email: "codyshanemitchell@gmail.com",
    } as any);
    vi.mocked(resolveDeveloperId).mockResolvedValue("dev-123");
    vi.mocked(getSuggestion).mockResolvedValue(baseSuggestion as any);
    vi.mocked(listSuggestionUpdates).mockResolvedValue(suggestionUpdates as any);

    const detail = await loadSuggestionDetailAction("suggestion-1");

    expect(resolveDeveloperId).toHaveBeenCalledWith("codyshanemitchell@gmail.com");
    expect(getSuggestion).toHaveBeenCalledWith("dev-123", "suggestion-1");
    expect(getSuggestionForSubmitter).not.toHaveBeenCalled();
    expect(detail.isDeveloper).toBe(true);
    expect(detail.suggestion.id).toBe("suggestion-1");
  });

  it("falls back to submitter access for non-developer viewers", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "viewer-2",
      email: "submitter@example.com",
    } as any);
    vi.mocked(resolveDeveloperId).mockResolvedValue("dev-123");
    vi.mocked(getSuggestionForSubmitter).mockResolvedValue(baseSuggestion as any);
    vi.mocked(listSuggestionUpdates).mockResolvedValue([] as any);

    const detail = await loadSuggestionDetailAction("suggestion-2");

    expect(resolveDeveloperId).toHaveBeenCalledWith("codyshanemitchell@gmail.com");
    expect(getSuggestionForSubmitter).toHaveBeenCalledWith("viewer-2", "submitter@example.com", "suggestion-2");
    expect(getSuggestion).not.toHaveBeenCalled();
    expect(detail.isDeveloper).toBe(false);
  });
});
