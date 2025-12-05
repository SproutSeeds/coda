"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type ToggleAction = () => Promise<{ success?: boolean; error?: string }>;

interface SubscriptionToggleProps {
    action: ToggleAction;
    label: string;
    variant: "cancel" | "renew";
}

export function SubscriptionToggle({ action, label, variant }: SubscriptionToggleProps) {
    const [isPending, startTransition] = useTransition();
    const [cooldown, setCooldown] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Countdown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    setError(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleClick = useCallback(() => {
        if (cooldown > 0 || isPending) return;

        startTransition(async () => {
            try {
                const result = await action();
                if (result?.error) {
                    // Parse cooldown time from error message
                    const match = result.error.match(/wait (\d+) seconds/);
                    if (match) {
                        setCooldown(parseInt(match[1], 10));
                    }
                    setError(result.error);
                } else {
                    // Success - refresh the page
                    router.refresh();
                }
            } catch {
                setError("Something went wrong. Please try again.");
            }
        });
    }, [action, cooldown, isPending, router]);

    const isDisabled = cooldown > 0 || isPending;

    const baseStyles = "cursor-pointer text-xs hover:underline transition-all duration-200";
    const variantStyles = variant === "cancel"
        ? "text-red-600 dark:text-red-400"
        : "text-emerald-600 dark:text-emerald-400";
    const disabledStyles = isDisabled ? "opacity-50 cursor-not-allowed hover:no-underline" : "";

    return (
        <div className="relative inline-flex items-center gap-2">
            <button
                type="button"
                onClick={handleClick}
                disabled={isDisabled}
                className={`${baseStyles} ${variantStyles} ${disabledStyles}`}
            >
                {isPending ? (
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                        {variant === "cancel" ? "Cancelling..." : "Renewing..."}
                    </span>
                ) : cooldown > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <CooldownRing seconds={cooldown} />
                        <span className="tabular-nums">{cooldown}s</span>
                    </span>
                ) : (
                    label
                )}
            </button>
        </div>
    );
}

function CooldownRing({ seconds }: { seconds: number }) {
    // Circular progress that depletes
    const maxSeconds = 60; // Assume 60s max for visual purposes
    const progress = Math.min(seconds / maxSeconds, 1);
    const circumference = 2 * Math.PI * 5; // radius = 5
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            className="text-muted-foreground/60"
        >
            {/* Background circle */}
            <circle
                cx="7"
                cy="7"
                r="5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.2"
            />
            {/* Progress circle */}
            <circle
                cx="7"
                cy="7"
                r="5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 7 7)"
                className="transition-all duration-1000 ease-linear"
            />
        </svg>
    );
}
