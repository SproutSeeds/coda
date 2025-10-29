import { NextResponse } from "next/server";
import { mintClientSessionToken } from "@/lib/devmode/session";
import { requireUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const relayUrl = process.env.DEVMODE_RELAY_URL || "wss://relay-falling-butterfly-779.fly.dev";
  try {
    const { ideaId, runnerId, projectRoot, sessionSlot } = (await req.json().catch(() => ({}))) as {
      ideaId?: string;
      runnerId?: string | null;
      projectRoot?: string | null;
      sessionSlot?: string;
    };
    const sessionId = crypto.randomUUID();
    const token = await mintClientSessionToken({
      sessionId,
      userId: user.id,
      ideaId: ideaId || undefined,
      runnerId: runnerId || undefined,
      projectRoot: projectRoot || undefined,
      sessionSlot: sessionSlot || "slot-1",
      ttlSec: 10 * 60,
    });
    return NextResponse.json({ relayUrl, sessionId, token });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to mint session" }, { status: 500 });
  }
}
