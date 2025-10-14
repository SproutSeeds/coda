"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ShowUndoToastOptions = {
  message: string;
  onUndo: () => Promise<void> | void;
  duration?: number;
  expiresAt?: string | Date;
};

const DEFAULT_DURATION_MS = 10_000;

function resolveDurationMs({ duration, expiresAt }: { duration?: number; expiresAt?: string | Date }): number {
  const fromExpiry = (() => {
    if (!expiresAt) return null;
    const expiryTime = typeof expiresAt === "string" ? Date.parse(expiresAt) : expiresAt.getTime();
    if (!Number.isFinite(expiryTime)) {
      return null;
    }
    return expiryTime - Date.now();
  })();

  const candidate = duration ?? fromExpiry ?? DEFAULT_DURATION_MS;

  if (!Number.isFinite(candidate)) {
    return DEFAULT_DURATION_MS;
  }

  const rounded = Math.round(candidate);
  return rounded > 0 ? rounded : 1;
}

export function showUndoToast(options: ShowUndoToastOptions) {
  const safeDuration = resolveDurationMs({ duration: options.duration, expiresAt: options.expiresAt });
  toast.custom((id) => <UndoToast id={id} message={options.message} onUndo={options.onUndo} duration={safeDuration} />, {
    duration: safeDuration,
  });
}

function UndoToast({ id, message, onUndo, duration }: { id: string | number; message: string; onUndo: () => Promise<void> | void; duration: number }) {
  const initialRemaining = useMemo(() => Math.max(0, Math.ceil(duration / 1_000)), [duration]);
  const [remaining, setRemaining] = useState(initialRemaining);

  useEffect(() => {
    if (duration <= 0) {
      setRemaining(0);
      return;
    }

    const endAt = Date.now() + duration;
    const interval = window.setInterval(() => {
      const millisLeft = endAt - Date.now();
      setRemaining(Math.max(0, Math.ceil(millisLeft / 1_000)));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [duration]);

  const handleUndo = async () => {
    await onUndo();
    toast.dismiss(id);
  };

  return (
    <div className="flex items-center gap-3 rounded-md bg-card px-4 py-3 shadow">
      <div>
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs text-muted-foreground">Undo expires in {remaining}s</p>
      </div>
      <Button size="sm" variant="outline" onClick={handleUndo}>
        Undo
      </Button>
    </div>
  );
}
