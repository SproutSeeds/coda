"use server";

import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { refundRequests, wallets, progression } from "@/lib/db/schema/monetization";
import { stripePost, stripeGet } from "@/lib/stripe/http";

const db = getDb();

export type RefundRequestWithUser = {
    id: string;
    userId: string;
    userEmail: string | null;
    userName: string | null;
    stripeChargeId: string | null;
    stripeInvoiceId: string | null;
    amountCents: number;
    reason: string;
    status: "pending" | "approved" | "denied";
    adminNotes: string | null;
    purchasedAt: Date;
    createdAt: Date;
    processedAt: Date | null;
};

/**
 * Get all pending refund requests (admin only)
 */
export async function getAdminRefundRequests(): Promise<{ requests: RefundRequestWithUser[]; error?: string }> {
    await requirePlatformAdmin();

    try {
        const requests = await db.select({
            id: refundRequests.id,
            userId: refundRequests.userId,
            stripeChargeId: refundRequests.stripeChargeId,
            stripeInvoiceId: refundRequests.stripeInvoiceId,
            amountCents: refundRequests.amountCents,
            reason: refundRequests.reason,
            status: refundRequests.status,
            adminNotes: refundRequests.adminNotes,
            purchasedAt: refundRequests.purchasedAt,
            createdAt: refundRequests.createdAt,
            processedAt: refundRequests.processedAt,
            userEmail: users.email,
            userName: users.name,
        })
            .from(refundRequests)
            .leftJoin(users, eq(refundRequests.userId, users.id))
            .orderBy(desc(refundRequests.createdAt));

        return { requests: requests as RefundRequestWithUser[] };
    } catch (err) {
        console.error("[Admin Refunds] Failed to fetch requests", err);
        return { requests: [], error: "Failed to load refund requests" };
    }
}

/**
 * Approve a refund request (admin only) - processes the refund via Stripe
 */
export async function approveRefundAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const admin = await requirePlatformAdmin();
    const requestId = formData.get("requestId") as string;
    const adminNotes = formData.get("adminNotes") as string;

    if (!requestId) {
        return { error: "Request ID is required" };
    }

    try {
        // Get the refund request
        const [request] = await db.select()
            .from(refundRequests)
            .where(eq(refundRequests.id, requestId));

        if (!request) {
            return { error: "Refund request not found" };
        }

        if (request.status !== "pending") {
            return { error: "This request has already been processed" };
        }

        if (!request.stripeChargeId) {
            return { error: "No charge ID found for this request" };
        }

        // Verify charge hasn't been refunded
        const charge = await stripeGet<{
            id: string;
            refunded: boolean;
        }>(`/charges/${encodeURIComponent(request.stripeChargeId)}`);

        if (charge.refunded) {
            // Mark as already approved (charge was refunded elsewhere)
            await db.update(refundRequests).set({
                status: "approved",
                adminUserId: admin.id,
                adminNotes: adminNotes || "Charge was already refunded",
                processedAt: new Date(),
            }).where(eq(refundRequests.id, requestId));

            revalidatePath("/dashboard/admin/refunds");
            return { success: true };
        }

        // Process the refund
        const refund = await stripePost<{ id: string; status: string }>("/refunds", new URLSearchParams({
            charge: request.stripeChargeId,
            reason: "requested_by_customer",
        }));

        // Update the request
        await db.update(refundRequests).set({
            status: "approved",
            adminUserId: admin.id,
            adminNotes: adminNotes || null,
            stripeRefundId: refund.id,
            processedAt: new Date(),
        }).where(eq(refundRequests.id, requestId));

        // If this was a subscription payment, cancel the subscription
        if (request.stripeInvoiceId) {
            try {
                const invoice = await stripeGet<{ subscription: string | null }>(`/invoices/${encodeURIComponent(request.stripeInvoiceId)}`);
                if (invoice.subscription) {
                    const [user] = await db.select().from(users).where(eq(users.id, request.userId));
                    if (user?.stripeSubscriptionId === invoice.subscription) {
                        await stripePost(`/subscriptions/${encodeURIComponent(invoice.subscription)}`, new URLSearchParams({
                            cancel_at_period_end: "false", // Cancel immediately
                        }));
                        await db.update(users).set({
                            planId: "wanderer",
                            stripeSubscriptionId: null,
                            subscriptionPeriodEnd: null,
                        }).where(eq(users.id, request.userId));
                    }
                }
            } catch (subErr) {
                console.error("[Admin Refunds] Failed to cancel subscription after refund", subErr);
                // Don't fail the whole operation, just log
            }
        }

        // Reset wallet and progression (keep booster balance - user paid separately for those)
        try {
            await db.update(wallets).set({
                manaBalance: 0,
                lastCoreGrantAt: null,
                // Note: boosterBalance is intentionally NOT reset - user paid separately for boosters
            }).where(eq(wallets.userId, request.userId));

            await db.update(progression).set({
                isChanneling: false,
                channelingExpiresAt: null,
            }).where(eq(progression.userId, request.userId));

            console.log(`[Admin Refunds] Reset wallet/progression for user ${request.userId}`);
        } catch (resetErr) {
            console.error("[Admin Refunds] Failed to reset wallet/progression after refund", resetErr);
            // Don't fail the whole operation, refund was already processed
        }

        revalidatePath("/dashboard/admin/refunds");
        return { success: true };
    } catch (err) {
        console.error("[Admin Refunds] Failed to approve refund", err);
        return { error: "Failed to process refund. Please try again." };
    }
}

/**
 * Deny a refund request (admin only)
 */
export async function denyRefundAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const admin = await requirePlatformAdmin();
    const requestId = formData.get("requestId") as string;
    const adminNotes = formData.get("adminNotes") as string;

    if (!requestId) {
        return { error: "Request ID is required" };
    }

    if (!adminNotes || adminNotes.length < 5) {
        return { error: "Please provide a reason for denying this request" };
    }

    try {
        // Get the refund request
        const [request] = await db.select()
            .from(refundRequests)
            .where(eq(refundRequests.id, requestId));

        if (!request) {
            return { error: "Refund request not found" };
        }

        if (request.status !== "pending") {
            return { error: "This request has already been processed" };
        }

        // Update the request
        await db.update(refundRequests).set({
            status: "denied",
            adminUserId: admin.id,
            adminNotes,
            processedAt: new Date(),
        }).where(eq(refundRequests.id, requestId));

        revalidatePath("/dashboard/admin/refunds");
        return { success: true };
    } catch (err) {
        console.error("[Admin Refunds] Failed to deny refund", err);
        return { error: "Failed to process request. Please try again." };
    }
}
