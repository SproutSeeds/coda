import { jwtVerify } from "jose";

function enc(s: string) { return new TextEncoder().encode(s); }

export async function verifyRunnerTokenHS256(token: string): Promise<{ runnerId: string; userId: string; jti?: string } | null> {
  try {
    const secret = process.env.DEVMODE_JWT_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(token, enc(secret));
    const runnerId = String(payload.runnerId || "");
    const userId = String(payload.userId || "");
    const jti = typeof payload.jti === "string" ? payload.jti : undefined;
    if (!runnerId || !userId) return null;
    return { runnerId, userId, jti };
  } catch {
    return null;
  }
}

