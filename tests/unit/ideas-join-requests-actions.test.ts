import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveJoinRequestAction,
  listJoinRequestsAction,
  markJoinRequestsSeenAction,
  resolveJoinRequestAction,
  updateJoinRequestReactionAction,
} from "@/app/dashboard/ideas/actions";

const {
  requireUserMock,
  listJoinRequestsForOwnerMock,
  getJoinRequestCountsMock,
  markJoinRequestsSeenMock,
  resolveJoinRequestMock,
  updateJoinRequestReactionMock,
  archiveJoinRequestMock,
  trackEventMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  listJoinRequestsForOwnerMock: vi.fn(),
  getJoinRequestCountsMock: vi.fn(),
  markJoinRequestsSeenMock: vi.fn(),
  resolveJoinRequestMock: vi.fn(),
  updateJoinRequestReactionMock: vi.fn(),
  archiveJoinRequestMock: vi.fn(),
  trackEventMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/utils/analytics", () => ({
  trackEvent: trackEventMock,
}));

vi.mock("@/lib/db/join-requests", () => ({
  archiveJoinRequest: archiveJoinRequestMock,
  createJoinRequest: vi.fn(),
  getJoinRequestCounts: getJoinRequestCountsMock,
  getJoinRequestForApplicant: vi.fn(),
  getPendingJoinRequest: vi.fn(),
  listJoinRequestsForOwner: listJoinRequestsForOwnerMock,
  markJoinRequestsSeen: markJoinRequestsSeenMock,
  resolveJoinRequest: resolveJoinRequestMock,
  updateJoinRequestReaction: updateJoinRequestReactionMock,
}));

describe("Idea join request actions", () => {
  beforeEach(() => {
    requireUserMock.mockResolvedValue({ id: "owner-1" });
    listJoinRequestsForOwnerMock.mockReset();
    getJoinRequestCountsMock.mockReset();
    markJoinRequestsSeenMock.mockReset();
    resolveJoinRequestMock.mockReset();
    updateJoinRequestReactionMock.mockReset();
    archiveJoinRequestMock.mockReset();
    trackEventMock.mockReset();
  });

  it("lists join requests with latest counts", async () => {
    listJoinRequestsForOwnerMock.mockResolvedValue([{ id: "req-1", ideaId: "idea-1", status: "pending" }]);
    getJoinRequestCountsMock.mockResolvedValue({ pending: 2, unseen: 1 });

    const result = await listJoinRequestsAction("idea-1");

    expect(requireUserMock).toHaveBeenCalled();
    expect(listJoinRequestsForOwnerMock).toHaveBeenCalledWith("owner-1", "idea-1", {
      includeArchived: false,
      includeProcessed: true,
    });
    expect(getJoinRequestCountsMock).toHaveBeenCalledWith("owner-1", "idea-1");
    expect(result).toEqual({ requests: [{ id: "req-1", ideaId: "idea-1", status: "pending" }], counts: { pending: 2, unseen: 1 } });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "idea_join_requests_viewed",
      properties: { ideaId: "idea-1", pending: 2, unseen: 1 },
    });
  });

  it("marks join requests as seen and returns refreshed counts", async () => {
    getJoinRequestCountsMock.mockResolvedValue({ pending: 0, unseen: 0 });

    const counts = await markJoinRequestsSeenAction({ ideaId: "idea-1", requestIds: ["req-1", "req-2"] });

    expect(markJoinRequestsSeenMock).toHaveBeenCalledWith("owner-1", "idea-1", ["req-1", "req-2"]);
    expect(getJoinRequestCountsMock).toHaveBeenCalledWith("owner-1", "idea-1");
    expect(counts).toEqual({ pending: 0, unseen: 0 });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "idea_join_requests_marked_seen",
      properties: { ideaId: "idea-1", requestCount: 2 },
    });
  });

  it("resolves a join request and refreshes counts", async () => {
    resolveJoinRequestMock.mockResolvedValue({
      request: { id: "req-3", ideaId: "idea-1", status: "approved" },
      collaboratorId: "collab-1",
    });
    getJoinRequestCountsMock.mockResolvedValue({ pending: 1, unseen: 0 });

    const result = await resolveJoinRequestAction({ requestId: "req-3", status: "approved", note: " welcome ", grantRole: "commenter" });

    expect(resolveJoinRequestMock).toHaveBeenCalledWith("owner-1", "req-3", {
      status: "approved",
      note: "welcome",
      grantRole: "commenter",
    });
    expect(getJoinRequestCountsMock).toHaveBeenCalledWith("owner-1", "idea-1");
    expect(result).toEqual({
      request: { id: "req-3", ideaId: "idea-1", status: "approved" },
      collaboratorId: "collab-1",
      counts: { pending: 1, unseen: 0 },
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "idea_join_request_resolved",
      properties: {
        ideaId: "idea-1",
        requestId: "req-3",
        status: "approved",
        grantRole: "commenter",
      },
    });
  });

  it("updates the owner reaction with normalized payload", async () => {
    updateJoinRequestReactionMock.mockResolvedValue({ id: "req-4", ideaId: "idea-1", status: "pending" });

    const result = await updateJoinRequestReactionAction({ requestId: "req-4", reaction: "  star  " });

    expect(updateJoinRequestReactionMock).toHaveBeenCalledWith("owner-1", "req-4", "star");
    expect(result).toEqual({ id: "req-4", ideaId: "idea-1", status: "pending" });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "idea_join_request_reacted",
      properties: {
        ideaId: "idea-1",
        requestId: "req-4",
        reaction: "star",
      },
    });
  });

  it("archives a processed request and returns updated counts", async () => {
    archiveJoinRequestMock.mockResolvedValue({ id: "req-5", ideaId: "idea-1", status: "rejected" });
    getJoinRequestCountsMock.mockResolvedValueOnce({ pending: 0, unseen: 0 });

    const result = await archiveJoinRequestAction("req-5");

    expect(archiveJoinRequestMock).toHaveBeenCalledWith("owner-1", "req-5");
    expect(getJoinRequestCountsMock).toHaveBeenCalledWith("owner-1", "idea-1");
    expect(result).toEqual({ request: { id: "req-5", ideaId: "idea-1", status: "rejected" }, counts: { pending: 0, unseen: 0 } });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "idea_join_request_archived",
      properties: { ideaId: "idea-1", requestId: "req-5" },
    });
  });
});
