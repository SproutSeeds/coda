import { SignJWT, jwtVerify } from "jose";

function enc(s: string) {
  return new TextEncoder().encode(s);
}

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Missing env: NEXTAUTH_SECRET");
  return secret;
}

export interface DeviceTokenPayload {
  sub: string;
  email: string;
  name?: string;
  type: "device";
  jti: string;
  iat: number;
  exp: number;
}

export async function createDeviceToken(user: { id: string; email: string; name?: string | null }): Promise<{ token: string; jti: string }> {
  const secret = getSecret();
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 365 * 24 * 60 * 60; // 1 year

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
    type: "device",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(enc(secret));

  return { token, jti };
}

export async function verifyDeviceToken(token: string): Promise<DeviceTokenPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, enc(secret));

    if (payload.type !== "device") {
      return null;
    }

    return {
      sub: String(payload.sub || ""),
      email: String(payload.email || ""),
      name: typeof payload.name === "string" ? payload.name : undefined,
      type: "device",
      jti: String(payload.jti || ""),
      iat: Number(payload.iat || 0),
      exp: Number(payload.exp || 0),
    };
  } catch {
    return null;
  }
}
