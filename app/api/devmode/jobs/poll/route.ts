import { NextResponse } from "next/server";
import { verifyCloudflareAccess } from "@/lib/devmode/verify";
import { getDevDb as getDb } from "@/lib/db";
import { devJobs } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { SignJWT, importPKCS8, type KeyLike } from "jose";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Optional: gate via Cloudflare Access
  const ok = await verifyCloudflareAccess(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const runnerId = url.searchParams.get("runnerId");
  if (!runnerId) return NextResponse.json({ error: "Missing runnerId" }, { status: 400 });

  try {
    const db = getDb();
    const [job] = await withDevModeBootstrap(async () => {
      const rows = await db
        .select()
        .from(devJobs)
        .where(eq(devJobs.state, "queued"))
        .orderBy(asc(devJobs.createdAt))
        .limit(1);
      return rows;
    });
    if (!job) return NextResponse.json({ job: null });

    // Mark dispatched
    const updatedRows = await db
      .update(devJobs)
      .set({ state: "dispatched", runnerId, startedAt: new Date() })
      .where(and(eq(devJobs.id, job.id), eq(devJobs.state, "queued")))
      .returning();
    const updated = updatedRows[0];
    if (!updated) {
      return NextResponse.json({ job: null });
    }

    // Mint short-lived ingest token for the runner
    const iss = process.env.DEV_MODE_ISS || "coda-dev";
    const aud = process.env.DEV_MODE_AUD || "coda-dev";
    const secret = process.env.DEV_MODE_PRIVATE_PEM;
    const alg = secret ? "RS256" : "HS256";
    const key: KeyLike | Uint8Array = secret
      ? await importPKCS8(secret, "RS256")
      : new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "dev-secret");
    const wsToken = await new SignJWT({ sub: updated.id, jobId: updated.id, typ: "log" })
      .setProtectedHeader({ alg })
      .setIssuer(iss)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);

    return NextResponse.json({ job: updated, wsToken });
  } catch (err: unknown) {
    const code = (err as { code?: string } | undefined)?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || /relation\s+"dev_jobs"\s+does\s+not\s+exist/i.test(message)) {
      return NextResponse.json(
        {
          error: "Dev Mode database migration not applied (dev_jobs missing)",
          hint: "Run `pnpm db:migrate` against the same DB used by the runner/server and restart.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message || "Internal error" }, { status: 500 });
  }
}
