"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function showUndoToast(options: { message: string; onUndo: () => Promise<void> | void; duration?: number }) {
  const { message, onUndo, duration = 10_000 } = options;
  toast.custom((id) => <UndoToast id={id} message={message} onUndo={onUndo} duration={duration} />, {
    duration,
  });
}

function UndoToast({ id, message, onUndo, duration }: { id: string | number; message: string; onUndo: () => Promise<void> | void; duration: number }) {
  const [remaining, setRemaining] = useState(duration / 1000);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemaining((value) => (value > 0 ? value - 1 : 0));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, []);

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
