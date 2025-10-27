import { SignJWT } from "jose";

function env(name: string, optional = false) {
  const v = process.env[name];
  if (!v && !optional) throw new Error(`Missing env: ${name}`);
  return v ?? "";
}

function enc(s: string) {
  return new TextEncoder().encode(s);
}

export async function mintClientSessionToken(params: {
  sessionId: string;
  userId: string;
  ideaId?: string | null;
  runnerId?: string | null;
  projectRoot?: string | null;
  ttlSec?: number;
}) {
  const secret = env("DEVMODE_JWT_SECRET");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (params.ttlSec ?? 10 * 60);
  const jwt = await new SignJWT({
    type: "client",
    sessionId: params.sessionId,
    userId: params.userId,
    ideaId: params.ideaId ?? undefined,
    runnerId: params.runnerId ?? undefined,
    projectRoot: params.projectRoot ?? undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(enc(secret));
  return jwt;
}

export async function mintRunnerToken(params: { runnerId: string; userId: string; ttlSec?: number; jti?: string }) {
  const secret = env("DEVMODE_JWT_SECRET");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (params.ttlSec ?? 30 * 24 * 60 * 60); // 30 days by default
  const jwt = await new SignJWT({ type: "runner", runnerId: params.runnerId, userId: params.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(params.jti || crypto.randomUUID())
    .sign(enc(secret));
  return jwt;
}
