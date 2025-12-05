import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/stripe/webhook-handler";
import { verifyStripeSignature } from "@/lib/stripe/signature";

// Ensure webhook runs on Node.js runtime for crypto operations
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("Stripe-Signature");

    try {
        const event = verifyStripeSignature(body, signature);
        await handleStripeEvent(event);
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Stripe] Webhook error:", error);

        // Return appropriate status code
        // 400 = Bad request (invalid signature, malformed payload)
        // 500 = Server error (processing failed, will trigger Stripe retry)
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
