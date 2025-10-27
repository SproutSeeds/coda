"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Device = { id: string; runnerId: string | null; approvedAt: string | null; createdAt: string };

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/devmode/pair/devices", { cache: "no-store" as RequestCache });
      const data = await res.json();
      if (res.ok) setDevices((data.devices || []) as Device[]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      const res = await fetch(`/api/devmode/pair/devices/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) setDevices((list) => list.filter((d) => d.id !== id));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Paired Devices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : devices.length === 0 ? (
            <div className="text-sm text-muted-foreground">No paired devices. Start the Runner and use Pair Runner to authorize this device.</div>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{d.runnerId || "(unnamed)"}</span>
                    <span className="text-muted-foreground">Approved: {d.approvedAt ? new Date(d.approvedAt).toLocaleString() : "—"}</span>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => revoke(d.id)} disabled={revoking === d.id}>
                    {revoking === d.id ? "Revoking…" : "Revoke"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

