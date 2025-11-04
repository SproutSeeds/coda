import { beforeEach, describe, expect, it, vi } from "vitest";

import { lookupCollaboratorEmailAction, searchCollaboratorDirectoryAction } from "@/app/dashboard/ideas/actions";

const requireUserMock = vi.hoisted(() => vi.fn());
const requireIdeaAccessMock = vi.hoisted(() => vi.fn());
const resolveCollaboratorEmailStatusMock = vi.hoisted(() => vi.fn());
const searchAccountDirectoryMock = vi.hoisted(() => vi.fn());
const listExistingCollaboratorIdsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireUser: requireUserMock,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/access", () => ({
  requireIdeaAccess: requireIdeaAccessMock,
  getIdeaAccess: vi.fn(),
}));

vi.mock("@/lib/db/users", () => ({
  resolveCollaboratorEmailStatus: resolveCollaboratorEmailStatusMock,
  searchAccountDirectory: searchAccountDirectoryMock,
  listExistingCollaboratorIds: listExistingCollaboratorIdsMock,
}));

vi.mock("@/lib/utils/analytics", () => ({
  trackEvent: vi.fn(),
}));

describe("Collaborator directory actions", () => {
  beforeEach(() => {
    requireUserMock.mockResolvedValue({ id: "owner-1" });
    requireIdeaAccessMock.mockResolvedValue(undefined);
    resolveCollaboratorEmailStatusMock.mockReset();
    searchAccountDirectoryMock.mockReset();
    listExistingCollaboratorIdsMock.mockReset();
  });

  describe("lookupCollaboratorEmailAction", () => {
    it("returns invalid status for malformed email", async () => {
      const result = await lookupCollaboratorEmailAction({ ideaId: "idea-1", email: "invalid-email" });

      expect(result.status).toBe("invalid");
      expect(requireIdeaAccessMock).not.toHaveBeenCalled();
      expect(resolveCollaboratorEmailStatusMock).not.toHaveBeenCalled();
    });

    it("resolves collaborator status for verified accounts", async () => {
      resolveCollaboratorEmailStatusMock.mockResolvedValue({
        status: "existing_account",
        user: { id: "user-1", email: "person@example.com", name: "Person", avatar: null },
      });

      const result = await lookupCollaboratorEmailAction({ ideaId: "idea-1", email: "person@example.com" });

      expect(requireIdeaAccessMock).toHaveBeenCalledWith("owner-1", "idea-1", "owner");
      expect(resolveCollaboratorEmailStatusMock).toHaveBeenCalledWith("idea-1", "person@example.com");
      expect(result.status).toBe("existing_account");
      expect(result.resolution).toMatchObject({
        status: "existing_account",
        user: { id: "user-1", email: "person@example.com" },
      });
    });
  });

  describe("searchCollaboratorDirectoryAction", () => {
    it("includes existing collaborator ids and viewer id in skip list", async () => {
      listExistingCollaboratorIdsMock.mockResolvedValue(["user-2", "user-3"]);
      searchAccountDirectoryMock.mockResolvedValue([
        { id: "user-4", email: "match@example.com", name: "Match", avatar: null, status: "invitable" },
      ]);

      const results = await searchCollaboratorDirectoryAction({ ideaId: "idea-1", query: "match" });

      expect(requireIdeaAccessMock).toHaveBeenCalledWith("owner-1", "idea-1", "owner");
      expect(searchAccountDirectoryMock).toHaveBeenCalledWith({
        ideaId: "idea-1",
        search: "match",
        limit: undefined,
        skipUserIds: ["user-2", "user-3", "owner-1"],
      });
      expect(results).toHaveLength(1);
    });
  });
});
