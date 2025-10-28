import { NextResponse } from "next/server";
import { verifyPreviewOrWsToken } from "@/lib/devmode/verify";
import { publish } from "@/lib/devmode/bus";
import { appendLogs } from "@/lib/devmode/db";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";
import type { JWTPayload } from "jose";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const token = url.searchParams.get("token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jobId || !token) return NextResponse.json({ error: "Missing jobId or token" }, { status: 400 });
  try {
    const payload = (await verifyPreviewOrWsToken(token)) as JWTPayload & { jobId?: string };
    if (typeof payload.jobId !== "string" || payload.jobId !== jobId) {
      return NextResponse.json({ error: "Token/job mismatch" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  type IngestBody = { lines?: Array<{ level?: string; line: string }> };
  const rawLines: Array<{ level?: string; line: string }> =
    typeof body === "object" && body !== null && Array.isArray((body as IngestBody).lines)
      ? ((body as IngestBody).lines as Array<{ level?: string; line: string }>)
      : [];
  // Sanitize: strip ANSI escape sequences and control chars to keep logs readable in UI
  const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;?]*[ -\/]*[@-~]/g, "").replace(/[\r\t]+/g, "");
  const lines = rawLines
    .map(({ level, line }) => ({ level, line: stripAnsi(String(line || "")) }))
    .map(({ level, line }) => ({ level, line: line.trimEnd() }))
    .filter(({ line }) => line.length > 0);
  const now = Date.now();
  for (const { level, line } of lines) {
    const lvl = level === "warn" || level === "error" ? level : "info";
    publish({ type: "log", jobId, ts: now, level: lvl, line });
  }
  try {
    await withDevModeBootstrap(() => appendLogs(jobId, lines));
  } catch {
    // Persistence failure shouldn't break live streaming
  }
  return NextResponse.json({ ok: true });
}
