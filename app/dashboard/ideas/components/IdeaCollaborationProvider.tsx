"use client";

import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react/suspense";
import type { PropsWithChildren } from "react";

import { LIVEBLOCKS_AUTH_ENDPOINT, LIVEBLOCKS_PUBLIC_KEY } from "@/lib/liveblocks/settings";
import { getIdeaRoomId } from "@/lib/liveblocks/rooms";

type IdeaCollaborationProviderProps = PropsWithChildren<{
  ideaId: string;
  accessRole: "owner" | "editor" | "commenter" | "viewer";
}>;

export function IdeaCollaborationProvider({ ideaId, accessRole, children }: IdeaCollaborationProviderProps) {
  const providerProps: { authEndpoint: string } | { publicApiKey: string } = LIVEBLOCKS_PUBLIC_KEY
    ? { publicApiKey: LIVEBLOCKS_PUBLIC_KEY }
    : { authEndpoint: LIVEBLOCKS_AUTH_ENDPOINT };

  return (
    <LiveblocksProvider {...providerProps} throttle={16}>
      <RoomProvider id={getIdeaRoomId(ideaId)} initialPresence={{ status: "viewing", focus: null, role: accessRole }}>
        <ClientSideSuspense fallback={<>{children}</>}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
