import { NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";

import { requireUser } from "@/lib/auth/session";
import { requireIdeaAccess } from "@/lib/db/access";
import { parseIdeaRoomId } from "@/lib/liveblocks/rooms";
import type { IdeaUserMetadata } from "@/lib/liveblocks/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    return NextResponse.json({ error: "Liveblocks not configured" }, { status: 501 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = parsed as { roomId?: unknown; room?: unknown };
  const roomIdRaw = payload.roomId ?? payload.room;
  const roomId = typeof roomIdRaw === "string" ? roomIdRaw : undefined;

  if (!roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }

  const ideaId = parseIdeaRoomId(roomId);
  if (!ideaId) {
    return NextResponse.json({ error: "Unknown room" }, { status: 400 });
  }

  const user = await requireUser();
  await requireIdeaAccess(user.id, ideaId, "read", { allowPublic: true });

  const client = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY });
  const metadata: IdeaUserMetadata = {
    name: user.name ?? undefined,
    email: user.email ?? null,
  };
  const session = client.prepareSession(user.id, { userInfo: metadata });

  session.allow(roomId, session.FULL_ACCESS);

  const { status, body } = await session.authorize();
  return new Response(body, { status });
}
