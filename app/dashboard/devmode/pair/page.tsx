"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function PairRunnerPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const submit = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/devmode/pair/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to approve");
        return;
      }
      toast.success("Runner paired");
      router.push("/dashboard/ideas");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Enable Dev Mode — Pair Runner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            On your computer, start the Coda Runner. It will show a short device code. Enter that code here to approve this device.
          </p>
          <p className="text-xs text-muted-foreground">
            Don’t have the Runner yet? <a className="underline" href="/dashboard/devmode/downloads">Download it</a> for your platform.
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting && code.trim() !== "") {
                  submit();
                }
              }}
              placeholder="e.g., F9G-7QK"
              className="uppercase tracking-widest"
            />
            <Button onClick={submit} disabled={submitting || code.trim() === ""}>{submitting ? "Approving…" : "Approve"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Code expires after 10 minutes. You can restart the runner to get a new code.</p>
        </CardContent>
      </Card>
    </div>
  );
}
