import { jwtVerify, importPKCS8, decodeJwt, type JWTPayload } from "jose";

function env(name: string, optional = false) {
  const v = process.env[name];
  if (!v && !optional) throw new Error(`Missing env: ${name}`);
  return v ?? "";
}

export async function verifyPreviewOrWsToken(token: string): Promise<JWTPayload> {
  const iss = env("DEV_MODE_ISS", true);
  const aud = env("DEV_MODE_AUD", true);
  const kid = env("DEV_MODE_KID", true);
  const pem = env("DEV_MODE_PRIVATE_PEM", true);

  // For now, we accept unsigned dev tokens if no keys configured (local dev only)
  if (!pem || !kid) {
    return decodeJwt(token);
  }

  // In production you'd verify against a public JWKS. For now, accept any token signed with provided private key (not ideal)
  // Better: keep a public JWKS and use createRemoteJWKSet(new URL(DEV_MODE_JWKS_URL))
  const alg = "RS256";
  const pk = await importPKCS8(pem, alg);
  const { payload } = await jwtVerify(token, pk, { issuer: iss || undefined, audience: aud || undefined });
  return payload;
}

export async function verifyCloudflareAccess(req: Request): Promise<boolean> {
  // Minimal stub: allow if CF-Access-Jwt-Assertion exists OR env CF_ACCESS_AUD not set.
  const aud = process.env.CF_ACCESS_AUD;
  if (!aud) return true; // not enforced
  const assertion = req.headers.get("Cf-Access-Jwt-Assertion") || req.headers.get("CF-Access-Jwt-Assertion");
  if (!assertion) return false;
  try {
    // Normally: verify via CF Access JWKS https://YOUR_DOMAIN.cloudflareaccess.com/cdn-cgi/access/certs
    // Here we just decode to check aud claim when present.
    const payload = decodeJwt(assertion);
    const tokenAud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (!tokenAud.length) return false;
    return tokenAud.includes(aud);
  } catch {
    return false;
  }
}
