"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { getRefundableCharges, selfServiceRefundAction, requestRefundAction, getRefundRequests, getRefundEstimate } from "./actions";

type RefundableCharge = {
    id: string;
    chargeId: string;
    invoiceId: string | null;
    amountCents: number;
    description: string;
    createdAt: Date;
    isWithinWindow: boolean;
    hasPendingRequest: boolean;
};

type RefundRequest = {
    id: string;
    status: "pending" | "approved" | "denied";
    amountCents: number;
    reason: string;
    createdAt: Date;
    processedAt: Date | null;
    adminNotes: string | null;
};

type RefundEstimate = {
    manaUsed: number;
    manaGranted: number;
    usageCostCents: number;
};

function formatCurrency(cents: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(cents / 100);
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function RefundModal({
    charge,
    onClose,
    onSuccess,
}: {
    charge: RefundableCharge;
    onClose: () => void;
    onSuccess: (refundedAmount?: number, usageCost?: number) => void;
}) {
    const [reason, setReason] = useState("");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [estimate, setEstimate] = useState<RefundEstimate | null>(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);

    // Fetch usage estimate when modal opens (only for self-service refunds)
    useEffect(() => {
        if (charge.isWithinWindow) {
            setLoadingEstimate(true);
            getRefundEstimate()
                .then(setEstimate)
                .catch(() => setEstimate(null))
                .finally(() => setLoadingEstimate(false));
        }
    }, [charge.isWithinWindow]);

    const estimatedRefund = estimate
        ? Math.max(0, charge.amountCents - estimate.usageCostCents)
        : charge.amountCents;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const formData = new FormData();
        formData.set("chargeId", charge.chargeId);
        formData.set("reason", reason);

        startTransition(async () => {
            const action = charge.isWithinWindow ? selfServiceRefundAction : requestRefundAction;
            const result = await action(formData);
            if (result.error) {
                setError(result.error);
            } else {
                // Pass back refund details for success message
                const refundResult = result as { refundedAmountCents?: number; usageCostCents?: number };
                onSuccess(refundResult.refundedAmountCents, refundResult.usageCostCents);
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="mx-4 w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-foreground">
                    {charge.isWithinWindow ? "Request Refund" : "Submit Refund Request"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    {charge.isWithinWindow
                        ? "Your refund will be processed immediately. Access will be revoked."
                        : "Your request will be reviewed by our team."}
                </p>

                <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{charge.description}</span>
                        <span className="font-semibold text-foreground">{formatCurrency(charge.amountCents)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Charged on {formatDate(charge.createdAt)}</p>
                </div>

                {/* Usage Cost Breakdown (self-service only) */}
                {charge.isWithinWindow && (
                    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            ⚠️ Refund will be prorated based on usage
                        </p>
                        {loadingEstimate ? (
                            <p className="text-xs text-muted-foreground">Calculating usage...</p>
                        ) : estimate ? (
                            <>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex justify-between">
                                        <span>Mana used:</span>
                                        <span>{estimate.manaUsed.toLocaleString()} / {estimate.manaGranted.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Usage cost:</span>
                                        <span className="text-red-600 dark:text-red-400">-{formatCurrency(estimate.usageCostCents)}</span>
                                    </div>
                                    <div className="flex justify-between font-medium text-sm text-foreground pt-1 border-t border-border/40">
                                        <span>Estimated refund:</span>
                                        <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(estimatedRefund)}</span>
                                    </div>
                                </div>
                                {estimatedRefund <= 0 && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                        Your usage exceeds the charge amount. No refund available.
                                    </p>
                                )}
                            </>
                        ) : null}
                        <p className="text-xs text-muted-foreground mt-2">
                            Your subscription will be canceled immediately and all access revoked.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-foreground">
                            Reason for refund
                        </label>
                        <textarea
                            id="reason"
                            name="reason"
                            rows={3}
                            required
                            minLength={charge.isWithinWindow ? 1 : 10}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={
                                charge.isWithinWindow
                                    ? "Why would you like a refund?"
                                    : "Please provide a detailed reason for your refund request (minimum 10 characters)"
                            }
                            className="mt-1 w-full rounded-xl border border-border/60 bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    {error && (
                        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isPending}
                            className="flex-1 cursor-pointer rounded-xl border border-border/60 bg-muted/50 px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || (charge.isWithinWindow && estimate !== null && estimatedRefund <= 0)}
                            className="flex-1 cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
                        >
                            {isPending
                                ? "Processing..."
                                : charge.isWithinWindow
                                ? `Refund ${formatCurrency(estimatedRefund)}`
                                : "Submit Request"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function RefundSection({
    initialCharges,
    initialRequests,
}: {
    initialCharges: RefundableCharge[];
    initialRequests: RefundRequest[];
}) {
    const [charges, setCharges] = useState(initialCharges);
    const [requests, setRequests] = useState(initialRequests);
    const [selectedCharge, setSelectedCharge] = useState<RefundableCharge | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleRefundSuccess = async (refundedAmount?: number, usageCost?: number) => {
        setSelectedCharge(null);

        let message = "Your refund has been processed successfully.";
        if (refundedAmount !== undefined) {
            message = `Refund of ${formatCurrency(refundedAmount)} processed successfully.`;
            if (usageCost && usageCost > 0) {
                message += ` (${formatCurrency(usageCost)} deducted for mana usage)`;
            }
            message += " Your subscription has been canceled and access revoked.";
        }
        setSuccessMessage(message);

        // Refresh data
        const [chargesResult, requestsResult] = await Promise.all([
            getRefundableCharges(),
            getRefundRequests(),
        ]);
        setCharges(chargesResult.charges);
        setRequests(requestsResult as RefundRequest[]);

        // Clear success message after 8 seconds (longer since there's more info)
        setTimeout(() => setSuccessMessage(null), 8000);
    };

    const handleRequestSuccess = async () => {
        setSelectedCharge(null);
        setSuccessMessage("Your refund request has been submitted for review.");

        // Refresh data
        const [chargesResult, requestsResult] = await Promise.all([
            getRefundableCharges(),
            getRefundRequests(),
        ]);
        setCharges(chargesResult.charges);
        setRequests(requestsResult as RefundRequest[]);

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
    };

    const pendingRequests = requests.filter((r) => r.status === "pending");
    const processedRequests = requests.filter((r) => r.status !== "pending");

    // Filter out charges that already have pending requests
    const availableCharges = charges.filter((c) => !c.hasPendingRequest);

    if (charges.length === 0 && requests.length === 0) {
        return null; // Don't show section if no payment history
    }

    return (
        <div className="space-y-4">

            {successMessage && (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                    {successMessage}
                </div>
            )}

            {/* Available for Refund */}
            {availableCharges.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Recent Payments</h3>
                    <div className="space-y-2">
                        {availableCharges.map((charge) => (
                            <div
                                key={charge.chargeId}
                                className="flex flex-col gap-2 rounded-lg border border-border/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">
                                            {formatCurrency(charge.amountCents)}
                                        </span>
                                        <span className="text-sm text-muted-foreground">{charge.description}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{formatDate(charge.createdAt)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {charge.isWithinWindow ? (
                                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                            Self-service
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                            Requires review
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCharge(charge)}
                                        className="cursor-pointer rounded-lg border border-border/60 bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                    >
                                        {charge.isWithinWindow ? "Refund" : "Request Refund"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Pending Requests</h3>
                    <div className="space-y-2">
                        {pendingRequests.map((request) => (
                            <div
                                key={request.id}
                                className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">
                                            {formatCurrency(request.amountCents)}
                                        </span>
                                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                            Pending Review
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Submitted {formatDate(request.createdAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Processed Requests History */}
            {processedRequests.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Refund History</h3>
                    <div className="space-y-2">
                        {processedRequests.slice(0, 5).map((request) => (
                            <div
                                key={request.id}
                                className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                                    request.status === "approved"
                                        ? "border-emerald-500/30 bg-emerald-500/5"
                                        : "border-red-500/30 bg-red-500/5"
                                }`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">
                                            {formatCurrency(request.amountCents)}
                                        </span>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                request.status === "approved"
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                                            }`}
                                        >
                                            {request.status === "approved" ? "Refunded" : "Denied"}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Processed {request.processedAt ? formatDate(request.processedAt) : ""}
                                    </p>
                                    {request.adminNotes && (
                                        <p className="mt-1 text-xs text-muted-foreground italic">
                                            &quot;{request.adminNotes}&quot;
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Refund Modal - rendered via portal to escape 3D transform context */}
            {selectedCharge && typeof document !== 'undefined' && createPortal(
                <RefundModal
                    charge={selectedCharge}
                    onClose={() => setSelectedCharge(null)}
                    onSuccess={selectedCharge.isWithinWindow ? handleRefundSuccess : handleRequestSuccess}
                />,
                document.body
            )}
        </div>
    );
}
