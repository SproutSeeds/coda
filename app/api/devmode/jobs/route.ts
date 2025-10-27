import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createJob } from "@/lib/devmode/db";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";
import type { CreateJobRequest } from "@/lib/devmode/types";
import { SignJWT, importPKCS8, type KeyLike } from "jose";

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const user = await requireUser();

  const idem = req.headers.get("Idempotency-Key") ?? undefined;
  if (!idem) return bad("Missing Idempotency-Key header");

  let body: CreateJobRequest;
  try {
    body = (await req.json()) as CreateJobRequest;
  } catch {
    return bad("Invalid JSON body");
  }
  if (!body.ideaId || !body.intent) return bad("Missing ideaId or intent");

  let job;
  try {
    job = await withDevModeBootstrap(() => createJob({
      ideaId: body.ideaId,
      intent: body.intent,
      idempotencyKey: body.idempotencyKey ?? idem,
      repoProvider: body.repoRef?.provider ?? null,
      repo: body.repoRef?.repo ?? null,
      branch: body.repoRef?.branch ?? null,
      sha: body.repoRef?.sha ?? null,
      env: body.env ?? null,
      timeoutMs: body.timeoutMs ?? null,
      createdBy: user.id,
    }));
  } catch (err: unknown) {
    const cause = (err as { cause?: { code?: string } } | undefined)?.cause;
    const code = (err as { code?: string } | undefined)?.code || cause?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || /relation\s+"dev_jobs"\s+does\s+not\s+exist/i.test(message)) {
      return NextResponse.json(
        {
          error: "Dev Mode database migration not applied (dev_jobs missing)",
          hint:
            "Run `pnpm db:migrate` with the SAME connection string your server uses (check getDb() resolution: DATABASE_URL → DATABASE_POSTGRES_URL → POSTGRES_URL → POSTGRES_PRISMA_URL → POSTGRES_URL_NON_POOLING → NEON_DATABASE_URL → NEON_POSTGRES_URL). Restart the server after migrating.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message || "Internal error" }, { status: 500 });
  }

  // short-lived WS/ingest token
  const iss = process.env.DEV_MODE_ISS || "coda-dev";
  const aud = process.env.DEV_MODE_AUD || "coda-dev";
  const secret = process.env.DEV_MODE_PRIVATE_PEM;
  const alg = secret ? "RS256" : "HS256";
  const key: KeyLike | Uint8Array = secret
    ? await importPKCS8(secret, "RS256")
    : new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "dev-secret");
  const wsToken = await new SignJWT({ sub: job.id, jobId: job.id, typ: "log" })
    .setProtectedHeader({ alg })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);

  return NextResponse.json({ jobId: job.id, wsToken });
}
