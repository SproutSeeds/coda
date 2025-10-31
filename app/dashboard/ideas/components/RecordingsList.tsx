"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Job = {
  id: string;
  intent: string;
  createdAt: string;
  state: string;
};

type LogRow = { id: string; level: string; text: string; seq: number; ts: string };

export function RecordingsList({ ideaId }: { ideaId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, LogRow[]>>({});
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  // Combined logs (daily)
  const [combinedDay, setCombinedDay] = useState<string | null>(null);
  const [combinedLogs, setCombinedLogs] = useState<Record<string, LogRow[]>>({});
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [confirmDay, setConfirmDay] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = async (refreshOpen = false) => {
    try {
      const res = await fetch(`/api/devmode/jobs/by-idea/${encodeURIComponent(ideaId)}?intent=terminal-record`, { cache: "no-store" as RequestCache });
      const data = await res.json();
      if (res.ok) setJobs(data.jobs || []);
    } catch {}
    // If requested, refresh currently open views
    if (refreshOpen) {
      // Refresh open per-session logs
      if (openId) {
        await openLogs(openId, true);
      }
      // Refresh combined for the visible day
      if (combinedDay) {
        try {
          await openCombined(combinedDay, true);
        } catch {}
      }
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load intentionally omits dependencies to avoid ref churn
  }, [ideaId]);

  const byDay = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const j of jobs) {
      const day = new Date(j.createdAt).toISOString().slice(0, 10);
      (map[day] ||= []).push(j);
    }
    // sort jobs in each day by createdAt asc
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    // sort days desc
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [jobs]);

  const openLogs = async (id: string, force = false) => {
    setOpenId((v) => (v === id ? null : id));
    if (!force && logs[id]) return;
    if (force) {
      setLogs((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/devmode/jobs/${encodeURIComponent(id)}/logs?limit=1000&t=${Date.now()}`, { cache: "no-store" as RequestCache });
      const text = await res.text();
      const data = text ? JSON.parse(text) : { logs: [] };
      if (res.ok) setLogs((m) => ({ ...m, [id]: (data.logs || []) as LogRow[] }));
      else toast.error((data?.error as string) || `Failed to load logs (${res.status})`);
    } finally {
      setLoading(false);
    }
  };

  const del = async (id: string) => {
    const res = await fetch(`/api/devmode/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setJobs((j) => j.filter((x) => x.id !== id));
      setOpenId((v) => (v === id ? null : v));
      setConfirmId(null);
    }
  };

  const fmt = (s: string) => new Date(s).toLocaleString();

  const toggleDay = (day: string) => setOpenDays((m) => ({ ...m, [day]: !m[day] }));

  const openCombined = async (day: string, force = false) => {
    if (!force && combinedDay === day && combinedLogs[day]) {
      setCombinedDay(null);
      return;
    }
    setCombinedDay(day);
    if (!force && combinedLogs[day]) return;
    if (force) {
      setCombinedLogs((m) => {
        const n = { ...m };
        delete n[day];
        return n;
      });
    }
    setCombinedLoading(true);
    try {
      const res = await fetch(`/api/devmode/logs/by-idea/${encodeURIComponent(ideaId)}/day/${encodeURIComponent(day)}?t=${Date.now()}`, { cache: "no-store" as RequestCache });
      const text = await res.text();
      const data = text ? JSON.parse(text) : { logs: [] };
      if (!res.ok) throw new Error(data?.error || `Failed to load combined logs`);
      const merged = (data.logs as LogRow[]).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      setCombinedLogs((m) => ({ ...m, [day]: merged }));
    } catch (e) {
      toast.error((e as Error).message || "Failed to load combined logs");
    } finally {
      setCombinedLoading(false);
    }
  };

  const downloadCombined = (day: string) => {
    const rows = combinedLogs[day] || [];
    const body = rows
      .map((l) => {
        const t = new Date(l.ts).toLocaleTimeString();
        const lvl = (l.level || "info").toUpperCase();
        return `[${t}] ${lvl} ${l.text}`;
      })
      .join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${day}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteDay = async (day: string, jobsInDay: Job[]) => {
    try {
      const res = await fetch(`/api/devmode/jobs/by-idea/${encodeURIComponent(ideaId)}/day/${encodeURIComponent(day)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data?.error as string) || `Failed to delete logs for ${day}`);
        return;
      }
      // Remove all jobs from this day from local state
      setJobs((prev) => prev.filter((j) => new Date(j.createdAt).toISOString().slice(0, 10) !== day));
      // Clear UI state for the day
      setOpenDays((m) => ({ ...m, [day]: false }));
      // Clear per-session logs cache for the day
      setLogs((m) => {
        const n = { ...m };
        for (const j of jobsInDay) delete n[j.id];
        return n;
      });
      setConfirmDay(null);
      toast.success(`Deleted ${data?.deleted ?? jobsInDay.length} recording(s) for ${day}`);
    } catch (e) {
      toast.error((e as Error).message || `Failed to delete logs for ${day}`);
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Session Logs</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? "Expand" : "Minimize"}
            </Button>
            <Button variant="secondary" size="sm" onClick={async () => { setReloading(true); try { await load(true); } finally { setReloading(false); }}}>
              {reloading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {collapsed ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          Session logs hidden. Expand to review recording history.
        </CardContent>
      ) : (
        <CardContent className="space-y-3">
          {byDay.length === 0 ? (
            <div className="text-sm text-muted-foreground">No session logs yet. Open a terminal; logging starts automatically.</div>
          ) : (
            byDay.map(([day, jobsInDay]) => (
              <div key={day} className="rounded border">
                <div className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" onClick={() => toggleDay(day)}>
                  <div className="flex items-center gap-3 cursor-pointer">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{day}</span>
                    <span className="text-muted-foreground">{jobsInDay.length} session{jobsInDay.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={combinedDay === day ? "secondary" : "default"} onClick={(e) => { e.stopPropagation(); void openCombined(day); }}>
                      {combinedDay === day ? "Hide Combined" : "Combined Logs"}
                    </Button>
                    {combinedDay === day ? (
                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); downloadCombined(day); }}>Download</Button>
                    ) : null}
                    {confirmDay === day ? (
                      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Delete all logs for {day}?</span>
                        <Button size="sm" variant="secondary" onClick={() => setConfirmDay(null)}>Cancel</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteDay(day, jobsInDay)}>Delete All</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setConfirmDay(day); }}>Delete All</Button>
                    )}
                  </div>
                </div>
                {combinedDay === day ? (
                  <div className="max-h-64 overflow-auto border-t bg-black p-2 font-mono text-xs text-green-300">
                    {combinedLoading ? (
                      <div className="p-2 text-muted-foreground">Loading…</div>
                    ) : (
                      (combinedLogs[day] || []).map((l, i) => (
                        <div key={l.id || `${l.seq}-${i}`}>
                          <span className="text-blue-300">[{new Date(l.ts).toLocaleTimeString()}]</span> {l.text}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
                {openDays[day] ? (
                  <div className="divide-y">
                    {jobsInDay.map((j) => (
                      <div key={j.id} className="">
                        <div className="flex items-center justify-between gap-2 p-2 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="rounded bg-muted px-2 py-0.5 text-xs">{j.intent}</span>
                            <span className="text-muted-foreground">{fmt(j.createdAt)}</span>
                            <code className="rounded bg-muted px-1">{j.id.slice(0, 8)}…</code>
                            <span className="rounded bg-muted px-1 text-xs">{j.state}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => openLogs(j.id)}>{openId === j.id ? "Hide Logs" : "View Logs"}</Button>
                            {confirmId === j.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Delete this recording?</span>
                                <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>Cancel</Button>
                                <Button size="sm" variant="destructive" onClick={() => del(j.id)}>Delete</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="destructive" onClick={() => setConfirmId(j.id)}>Delete</Button>
                            )}
                          </div>
                        </div>
                        {openId === j.id ? (
                          <div className="max-h-64 overflow-auto border-t bg-black p-2 font-mono text-xs text-green-300">
                            {loading ? (
                              <div className="p-2 text-muted-foreground">Loading…</div>
                            ) : (
                              (logs[j.id] || []).map((l, i) => (
                                <div key={l.id || `${l.seq}-${i}`}>
                                  <span className="text-blue-300">[{l.level}]</span> {l.text}
                                </div>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}
