"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReferralLinkProps {
  userId: string;
  totalSummons?: number;
}

export function ReferralLink({ userId, totalSummons = 0 }: ReferralLinkProps) {
  const [copied, setCopied] = useState(false);
  // In a real app, use the actual domain from env or window.location
  const link = `https://coda.dev/signup?ref=${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2 pl-4">
        <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-mono text-muted-foreground">
          {link}
        </code>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-all cursor-pointer",
            copied
              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
              : "bg-background text-foreground hover:bg-muted"
          )}
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      {totalSummons > 0 && (
        <p className="text-xs text-muted-foreground">
          You have summoned {totalSummons} {totalSummons === 1 ? "seeker" : "seekers"} so far.
        </p>
      )}
    </div>
  );
}
