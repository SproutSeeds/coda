import { createHmac, timingSafeEqual } from "node:crypto";

import { stripeEnv } from "./config";

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
};

type ParsedSignatureHeader = {
  timestamp: number;
  signatures: string[];
};

const DEFAULT_TOLERANCE_SECONDS = 5 * 60; // 5 minutes

export function verifyStripeSignature(payload: string, signatureHeader: string | null, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS): StripeEvent {
  const secret = stripeEnv.webhookSecret;
  if (!secret) {
    throw new Error("Stripe webhook secret is not configured");
  }
  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header");
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed || parsed.signatures.length === 0) {
    throw new Error("Invalid Stripe-Signature header");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) {
    throw new Error("Stripe signature timestamp outside tolerance window");
  }

  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const isValid = parsed.signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "hex");
    if (candidateBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });

  if (!isValid) {
    throw new Error("Stripe signature verification failed");
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch (error) {
    throw new Error(`Unable to parse Stripe webhook payload: ${(error as Error).message}`);
  }

  if (!event || typeof event !== "object" || typeof event.type !== "string") {
    throw new Error("Invalid Stripe event payload");
  }

  return event;
}

function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  const pairs = header.split(",").map((part) => part.trim());
  let timestamp = 0;
  const signatures: string[] = [];

  for (const pair of pairs) {
    if (pair.startsWith("t=")) {
      const value = Number(pair.slice(2));
      if (!Number.isNaN(value)) {
        timestamp = value;
      }
    } else if (pair.startsWith("v1=")) {
      signatures.push(pair.slice(3));
    }
  }

  if (!timestamp) {
    return null;
  }

  return { timestamp, signatures };
}
