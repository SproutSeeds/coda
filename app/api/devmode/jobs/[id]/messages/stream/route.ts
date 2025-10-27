import { subscribe } from "@/lib/devmode/bus";
import type { StreamEvent } from "@/lib/devmode/types";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await ctx.params;
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (e: StreamEvent) => {
        if (closed || !e || e.type !== "message" || e.jobId !== jobId) return;
        safeEnqueue(`data: ${JSON.stringify(e)}\n\n`);
      };
      const off = subscribe(jobId, send);
      const hb = setInterval(() => {
        if (closed) return clearInterval(hb);
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);
      safeEnqueue(`retry: 5000\n\n`);
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
