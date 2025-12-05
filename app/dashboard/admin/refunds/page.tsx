import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { getAdminRefundRequests } from "./actions";
import { RefundRequestsList } from "./refund-requests-list";

export const metadata = {
    title: "Refund Requests - Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminRefundsPage() {
    await requirePlatformAdmin();

    const { requests, error } = await getAdminRefundRequests();

    const pendingRequests = requests.filter(r => r.status === "pending");
    const processedRequests = requests.filter(r => r.status !== "pending");

    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-semibold uppercase tracking-wide text-primary">Admin Console</p>
                    <h1 className="text-3xl font-bold text-foreground">Refund Requests</h1>
                    <p className="text-sm text-muted-foreground">
                        Review and process refund requests from users.
                    </p>
                </div>
                <Link
                    href="/dashboard/billing"
                    className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/50 px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Back to Billing
                </Link>
            </header>

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Pending Requests */}
            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-2 mb-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-foreground">Pending Requests</h2>
                        {pendingRequests.length > 0 && (
                            <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                                {pendingRequests.length}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Requests awaiting your review.
                    </p>
                </div>

                {pendingRequests.length === 0 ? (
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-8 text-center">
                        <p className="text-sm text-muted-foreground">No pending refund requests.</p>
                    </div>
                ) : (
                    <RefundRequestsList requests={pendingRequests} showActions />
                )}
            </section>

            {/* Processed Requests */}
            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-2 mb-6">
                    <h2 className="text-lg font-semibold text-foreground">Processed Requests</h2>
                    <p className="text-sm text-muted-foreground">
                        Previously approved or denied requests.
                    </p>
                </div>

                {processedRequests.length === 0 ? (
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-8 text-center">
                        <p className="text-sm text-muted-foreground">No processed requests yet.</p>
                    </div>
                ) : (
                    <RefundRequestsList requests={processedRequests} showActions={false} />
                )}
            </section>
        </div>
    );
}
