import { NextResponse } from "next/server";
import { verifyCloudflareAccess } from "@/lib/devmode/verify";
import { registerRunner } from "@/lib/devmode/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ok = await verifyCloudflareAccess(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; name?: string; capabilities?: string[] };
  if (!body.id || !body.name) return NextResponse.json({ error: "Missing id or name" }, { status: 400 });
  const row = await registerRunner({ id: body.id, name: body.name, capabilities: body.capabilities ?? [] });
  return NextResponse.json({ runner: row });
}

