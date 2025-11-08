import type { LimitPayerResolution } from "@/lib/limits/types";

export function actorPays(userId: string, metadata?: Record<string, unknown>): LimitPayerResolution {
  return {
    primary: { type: "user", id: userId },
    fallback: null,
    strategy: "actor",
    metadata,
  };
}

export function workspaceCovers(
  workspaceId: string,
  fallbackUserId?: string | null,
  metadata?: Record<string, unknown>,
): LimitPayerResolution {
  return {
    primary: { type: "workspace", id: workspaceId },
    fallback: fallbackUserId ? { type: "user", id: fallbackUserId } : null,
    strategy: fallbackUserId ? "shared" : "workspace",
    metadata: { workspaceId, ...metadata },
  };
}

