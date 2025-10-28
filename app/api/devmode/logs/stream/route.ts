import { subscribe } from "@/lib/devmode/bus";
import type { StreamEvent } from "@/lib/devmode/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (event: StreamEvent) => {
        if (closed || !event || event.jobId !== jobId) return;
        safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
      };
      const off = subscribe(jobId, send);
      // heartbeat
      const hb = setInterval(() => {
        if (closed) return clearInterval(hb);
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);
      // Suggest clients retry after 5s if the connection drops.
      safeEnqueue(`retry: 5000\n\n`);
      safeEnqueue(`: connected\n\n`);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
        clearInterval(hb);
        off();
      };
      return cleanup;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
