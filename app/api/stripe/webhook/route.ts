import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/stripe/webhook-handler";
import { verifyStripeSignature } from "@/lib/stripe/signature";

// DEPRECATED: This endpoint is kept for backwards compatibility.
// The canonical webhook endpoint is /api/webhooks/stripe
// Please update your Stripe dashboard webhook configuration.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.warn("[Stripe] DEPRECATED: /api/stripe/webhook called. Please update to /api/webhooks/stripe");

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature");

  try {
    const event = verifyStripeSignature(body, signature);
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe] Webhook error:", error);

    const statusCode = error instanceof Error && error.message.includes("signature")
      ? 400
      : 500;

    return NextResponse.json(
      {
        error: "Webhook handler failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: statusCode }
    );
  }
}
