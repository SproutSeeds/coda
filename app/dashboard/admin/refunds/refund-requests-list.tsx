"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { approveRefundAction, denyRefundAction, type RefundRequestWithUser } from "./actions";

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
        hour: "2-digit",
        minute: "2-digit",
    });
}

function ActionModal({
    request,
    action,
    onClose,
    onSuccess,
}: {
    request: RefundRequestWithUser;
    action: "approve" | "deny";
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [notes, setNotes] = useState("");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const formData = new FormData();
        formData.set("requestId", request.id);
        formData.set("adminNotes", notes);

        startTransition(async () => {
            const actionFn = action === "approve" ? approveRefundAction : denyRefundAction;
            const result = await actionFn(formData);
            if (result.error) {
                setError(result.error);
            } else {
                onSuccess();
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
                    {action === "approve" ? "Approve Refund" : "Deny Refund"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    {action === "approve"
                        ? "This will process the refund immediately via Stripe."
                        : "Please provide a reason for denying this request."}
                </p>

                <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                            {request.userEmail || request.userId.slice(0, 8)}
                        </span>
                        <span className="font-semibold text-foreground">{formatCurrency(request.amountCents)}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{request.reason}</p>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-foreground">
                            Admin Notes {action === "deny" && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            rows={3}
                            required={action === "deny"}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={
                                action === "approve"
                                    ? "Optional notes (visible to user)"
                                    : "Reason for denial (required, visible to user)"
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
                            disabled={isPending}
                            className={`flex-1 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
                                action === "approve"
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-red-600 hover:bg-red-700"
                            }`}
                        >
                            {isPending
                                ? "Processing..."
                                : action === "approve"
                                ? "Approve & Refund"
                                : "Deny Request"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function RefundRequestsList({
    requests,
    showActions,
}: {
    requests: RefundRequestWithUser[];
    showActions: boolean;
}) {
    const [selectedRequest, setSelectedRequest] = useState<RefundRequestWithUser | null>(null);
    const [selectedAction, setSelectedAction] = useState<"approve" | "deny" | null>(null);

    const handleActionSuccess = () => {
        setSelectedRequest(null);
        setSelectedAction(null);
        // The page will be revalidated via the server action
    };

    return (
        <>
            <div className="space-y-3">
                {requests.map((request) => (
                    <div
                        key={request.id}
                        className={`rounded-xl border p-4 ${
                            request.status === "pending"
                                ? "border-amber-500/30 bg-amber-500/5"
                                : request.status === "approved"
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-red-500/30 bg-red-500/5"
                        }`}
                    >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-foreground">
                                        {formatCurrency(request.amountCents)}
                                    </span>
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                            request.status === "pending"
                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                : request.status === "approved"
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                                        }`}
                                    >
                                        {request.status === "pending"
                                            ? "Pending"
                                            : request.status === "approved"
                                            ? "Approved"
                                            : "Denied"}
                                    </span>
                                </div>

                                <div className="text-sm">
                                    <span className="text-muted-foreground">User: </span>
                                    <span className="text-foreground">
                                        {request.userEmail || request.userName || request.userId.slice(0, 8)}
                                    </span>
                                </div>

                                <div className="text-sm">
                                    <span className="text-muted-foreground">Reason: </span>
                                    <span className="text-foreground">{request.reason}</span>
                                </div>

                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                    <span>Purchased: {formatDate(request.purchasedAt)}</span>
                                    <span>Requested: {formatDate(request.createdAt)}</span>
                                    {request.processedAt && (
                                        <span>Processed: {formatDate(request.processedAt)}</span>
                                    )}
                                </div>

                                {request.adminNotes && (
                                    <div className="mt-2 rounded-lg border border-border/40 bg-muted/30 p-2 text-sm">
                                        <span className="text-muted-foreground">Admin notes: </span>
                                        <span className="text-foreground italic">{request.adminNotes}</span>
                                    </div>
                                )}

                                {request.stripeChargeId && (
                                    <div className="text-xs text-muted-foreground">
                                        Charge: <code className="rounded bg-muted px-1.5 py-0.5">{request.stripeChargeId}</code>
                                    </div>
                                )}
                            </div>

                            {showActions && request.status === "pending" && (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedRequest(request);
                                            setSelectedAction("approve");
                                        }}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                    >
                                        <Check className="size-4" />
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedRequest(request);
                                            setSelectedAction("deny");
                                        }}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
                                    >
                                        <X className="size-4" />
                                        Deny
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {selectedRequest && selectedAction && (
                <ActionModal
                    request={selectedRequest}
                    action={selectedAction}
                    onClose={() => {
                        setSelectedRequest(null);
                        setSelectedAction(null);
                    }}
                    onSuccess={handleActionSuccess}
                />
            )}
        </>
    );
}
